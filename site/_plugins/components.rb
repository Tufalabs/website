# The identity's content components, from what Markdown writes (identity/css/base.css styles them):
#   a blockquote opening with a bold "Label: statement" (or "Label - statement") is a callout: the label in the label
#   voice, the statement, the reasoning below;
#   a citation section's "Please cite this work as" and the reference after it take the citation's classes.
module TufaLabs
  module Components
    def self.callout(body)
      head = body.match(%r{\A\s*<p>((?:<strong>.*?</strong>\s*)+)</p>}m)
      return nil unless head
      text = head[1].gsub(%r{</?strong>}, "").strip
      lab = text.match(/\A([^:\-–]{2,40}?)\s*(?::|\s[-–]\s)\s*(.+)\z/m)
      label, title = (lab && lab[1].split.size <= 4) ? [lab[1].strip, lab[2].strip] : ["", text]
      title = title[0].upcase + title[1..] unless title.empty?   # a statement starts a sentence once its label is set apart
      %(<blockquote class="callout">) + (label.empty? ? "" : %(<span class="callout-label">#{label}</span>)) +
        %(<p class="callout-title">#{title}</p>) + body[head.end(0)..] + "</blockquote>"
    end

    def self.apply(html)
      html = html.gsub(%r{<blockquote>(.*?)</blockquote>}m) { callout(Regexp.last_match(1)) || Regexp.last_match(0) }
      html.sub(%r{(<h2 id="citation">.*?</h2>\s*)<p>\s*(Please cite[^<]*?):?\s*</p>(\s*)<p>}m) do
        %(#{Regexp.last_match(1)}<p class="citation-label">#{Regexp.last_match(2)}</p>#{Regexp.last_match(3)}<p class="citation-ref">)
      end
    end
  end
end

Jekyll::Hooks.register [:documents, :pages], :post_render do |doc|
  doc.output = TufaLabs::Components.apply(doc.output) if doc.output_ext == ".html" && doc.output.include?("<blockquote") || doc.output.to_s.include?('id="citation"')
end
