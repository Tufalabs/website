# The identity's content components, from what Markdown writes (identity/css/base.css styles them):
#   a blockquote opening with a bold "Label: statement" (or "Label - statement") is a callout: the label in the label
#   voice, the statement, the reasoning below;
#   a citation section's "Please cite this work as" and the reference after it take the citation's classes;
#   a Luma event card is a callout (what, when and where, the way to Luma) with its cover in the aside.
require "date"
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

    # the event card: an event over by the build's date says so and links to its page instead of registering; the cover
    # comes from Luma's image service at the aside's size (12ℓ, twice for sharp screens) instead of the full upload, cut
    # to its drawn frame (the Tufa Talks covers keep 22 of their 1024 px white around it), so the frame is the callout's height
    def self.event(card)
      get = ->(pat) { (card.match(pat) || [nil, ""])[1].strip }
      href, src = get.(/href="([^"]+)"/), get.(/<img [^>]*src="([^"]+)"/)
      title = get.(%r{external-event-card-title"><a [^>]*>(.*?)</a>}m)
      desc = get.(%r{external-event-card-description">(.*?)</p>}m)
      whn = get.(%r{external-event-card-meta">(.*?)</p>}m).match(/\A([A-Z][a-z]+ \d{1,2}, \d{4})(?: · (\d[^·]*?))?(?: · (.+))?\z/m)
      return card if href.empty? || title.empty? || !whn
      day = Date.strptime(whn[1], "%B %d, %Y")
      past = day < Date.today
      hours = (whn[2] || "").gsub(/(\d)-(\d)/, "\\1–\\2")   # a range takes the en dash: 18:00–20:00
      cover = src.sub(%r{\Ahttps://images\.lumacdn\.com/(?:cdn-cgi/image/[^/]+/)?},
        "https://images.lumacdn.com/cdn-cgi/image/format=auto,fit=cover,dpr=2,background=white,quality=75,trim=22;22;21;22,width=288,height=288/")
      out = %(href="#{href}" target="_blank" rel="noopener")
      %(<div class="event">\n<div class="callout">) +
        %(<span class="callout-label">#{past ? "Past event" : "Luma event"}</span>) +
        %(<p class="callout-title"><a #{out}>#{title}</a></p>) +
        %(<p class="event-when"><time datetime="#{day.iso8601}">#{whn[1]}#{hours.empty? ? "" : " · " + hours}</time>) +
        (whn[3] ? %( <span>#{whn[3]}</span>) : "") + "</p>" +
        (desc.empty? ? "" : "<p>#{desc}</p>") +
        %(<a class="read-more" #{out}>#{past ? "Event page on Luma" : "Register on Luma"}</a></div>\n) +
        (src.empty? ? "" : %(<a class="event-cover" #{out} tabindex="-1" aria-hidden="true"><img src="#{cover}" alt="" width="288" height="288" loading="lazy" decoding="async"></a>\n)) +
        "</div>"
    end

    def self.apply(html)
      html = html.gsub(%r{<blockquote>(.*?)</blockquote>}m) { callout(Regexp.last_match(1)) || Regexp.last_match(0) }
      html = html.gsub(%r{<div class="external-event-card">.*?</div>\s*</div>}m) { event(Regexp.last_match(0)) }
      html.sub(%r{(<h2 id="citation">.*?</h2>\s*)<p>\s*(Please cite[^<]*?):?\s*</p>(\s*)<p>}m) do
        %(#{Regexp.last_match(1)}<p class="citation-label">#{Regexp.last_match(2)}</p>#{Regexp.last_match(3)}<p class="citation-ref">)
      end
    end
  end
end

Jekyll::Hooks.register [:documents, :pages], :post_render do |doc|
  doc.output = TufaLabs::Components.apply(doc.output) if doc.output_ext == ".html" && doc.output.match?(/<blockquote|id="citation"|external-event-card/)
end
