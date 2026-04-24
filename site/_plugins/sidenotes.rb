module TufaLabs
  class NoteTag < Liquid::Block
    NOTE_ID_PATTERN = /\A[a-zA-Z][a-zA-Z0-9_-]*\z/

    def initialize(tag_name, markup, tokens)
      super
      @tag_name = tag_name
      @note_id = markup.to_s.strip

      raise Liquid::SyntaxError, "#{@tag_name} tag requires a note id" if @note_id.empty?

      unless NOTE_ID_PATTERN.match?(@note_id)
        raise Liquid::SyntaxError,
              "#{@tag_name} tag id #{@note_id.inspect} must start with a letter and contain only letters, numbers, dashes, or underscores"
      end
    end

    def render(context)
      note_body = super(context).to_s.strip
      raise Jekyll::Errors::FatalException, "#{@tag_name} tag #{@note_id.inspect} requires note content#{page_location(context)}" if note_body.empty?

      converter = context.registers[:site].find_converter_instance(Jekyll::Converters::Markdown)
      note_html = converter.convert(note_body).strip
      inline_html = extract_inline_html(note_html, context)
      inline_html = externalize_links(inline_html)

      rendered_note(inline_html)
    end

    private

    def extract_inline_html(note_html, context)
      match = note_html.match(/\A<p>(.*)<\/p>\z/m)
      return match[1].strip if match

      raise Jekyll::Errors::FatalException,
            "#{@tag_name} tag #{@note_id.inspect} must render to a single paragraph#{page_location(context)}"
    end

    def externalize_links(inline_html)
      inline_html.gsub(/<a href="([^"]+)"/) do |match|
        href = Regexp.last_match(1)
        next match unless href.start_with?("http://", "https://")

        %(<a href="#{href}" target="_blank" rel="noopener noreferrer")
      end
    end

    def page_location(context)
      page = context.registers[:page]
      path = page && (page["path"] || page["name"])
      path ? " in #{path}" : ""
    end
  end

  class SidenoteTag < NoteTag
    def render(context)
      register_note(context)
      super
    end

    def rendered_note(inline_html)
      note_anchor = "sidenote-#{@note_id}"
      %(<label for="#{@note_id}" class="margin-toggle sidenote-number"></label><input type="checkbox" id="#{@note_id}" class="margin-toggle" /><span id="#{note_anchor}" class="sidenote">#{inline_html}</span>)
    end

    private

    def register_note(context)
      registry = context.registers[:tufa_sidenotes] ||= { order: [], numbers: {} }
      if registry[:numbers].key?(@note_id)
        raise Jekyll::Errors::FatalException,
              "sidenote tag #{@note_id.inspect} is defined more than once#{page_location(context)}"
      end

      registry[:order] << @note_id
      registry[:numbers][@note_id] = registry[:order].size
    end
  end

  class MarginnoteTag < NoteTag
    def rendered_note(inline_html)
      %(<label for="#{@note_id}" class="margin-toggle marginnote-toggle">&#8853;</label><input type="checkbox" id="#{@note_id}" class="margin-toggle" /><span class="marginnote">#{inline_html}</span>)
    end
  end
end

Liquid::Template.register_tag("sidenote", TufaLabs::SidenoteTag)
Liquid::Template.register_tag("marginnote", TufaLabs::MarginnoteTag)

module TufaLabs
  class SidenoteRefTag < Liquid::Tag
    NOTE_ID_PATTERN = NoteTag::NOTE_ID_PATTERN

    def initialize(tag_name, markup, tokens)
      super
      @note_id = markup.to_s.strip
      raise Liquid::SyntaxError, "#{tag_name} tag requires a note id" if @note_id.empty?

      unless NOTE_ID_PATTERN.match?(@note_id)
        raise Liquid::SyntaxError,
              "#{tag_name} tag id #{@note_id.inspect} must start with a letter and contain only letters, numbers, dashes, or underscores"
      end
    end

    def render(context)
      registry = context.registers[:tufa_sidenotes]
      note_number = registry && registry[:numbers][@note_id]

      unless note_number
        raise Jekyll::Errors::FatalException,
              "sidenoteref tag #{@note_id.inspect} must refer to an earlier sidenote#{page_location(context)}"
      end

      %(<a href="#sidenote-#{@note_id}" class="sidenote-ref" aria-label="Jump to sidenote #{note_number}">#{note_number}</a>)
    end

    private

    def page_location(context)
      page = context.registers[:page]
      path = page && (page["path"] || page["name"])
      path ? " in #{path}" : ""
    end
  end
end

Liquid::Template.register_tag("sidenoteref", TufaLabs::SidenoteRefTag)
