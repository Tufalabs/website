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

      rendered_note(inline_html)
    end

    private

    def extract_inline_html(note_html, context)
      match = note_html.match(/\A<p>(.*)<\/p>\z/m)
      return match[1].strip if match

      raise Jekyll::Errors::FatalException,
            "#{@tag_name} tag #{@note_id.inspect} must render to a single paragraph#{page_location(context)}"
    end

    def page_location(context)
      page = context.registers[:page]
      path = page && (page["path"] || page["name"])
      path ? " in #{path}" : ""
    end
  end

  class SidenoteTag < NoteTag
    def rendered_note(inline_html)
      %(<label for="#{@note_id}" class="margin-toggle sidenote-number"></label><input type="checkbox" id="#{@note_id}" class="margin-toggle" /><span class="sidenote">#{inline_html}</span>)
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
