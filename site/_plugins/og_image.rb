# Link previews: give each page and document the image /assets/og/<slug>.png when that file exists, so
# jekyll-seo-tag emits og:image / twitter:image for it (slug: the URL path joined by dashes, "home" for /).
# Pages without their own card fall back to the home card; front matter `image:` still wins. The images are drawn from the pages' own heads (redesign/tools).
module TufaLabs
  module OgImage
    def self.slug(url)
      s = url.to_s.sub(%r{index\.html$}, "").gsub(%r{^/|/$}, "").tr("/", "-")
      s.empty? ? "home" : s
    end

    def self.assign(site, doc)
      return if doc.data["image"] || doc.data["noindex"]
      rel = "/assets/og/#{slug(doc.url)}.png"
      rel = "/assets/og/home.png" unless File.exist?(File.join(site.source, rel))   # a new page without its own card yet
      doc.data["image"] = rel if File.exist?(File.join(site.source, rel))
    end
  end
end

Jekyll::Hooks.register [:pages, :documents], :pre_render do |doc|
  TufaLabs::OgImage.assign(doc.site, doc) if doc.output_ext == ".html"
end
