---
title: 'Annotating the Rails View Cache'
date: 2012-11-10
featured_image: /images/blog/annotating-the-rails-view-cache.jpg
image_caption: Photo by Eduardo C.G. on Unsplash
tags:
  - blog
  - rails
---

The Rails [View Cache](http://guides.rubyonrails.org/v2.3.11/caching_with_rails.html) is a powerful tool to use against those pesky performance problems.

Caching is, as they say, a bit like violence -- if it's not solving your problem, you aren't using enough of it. However, they also say that caching is one of the truly hard problems in computer science. Which leads me to this blog post...

Let's suppose that after liberally sprinkling cache statements everywhere in your view code, your site is super fast, and everything is working fine. Except when it isn't. So you're spelunking through the HTML in the browser trying to debug things, but how can you tell which HTML content came from the cache? And when was it cached?

Just pop this short incantation in `config/initializers/annotate_view_cache.rb`

```ruby
module ActionView
  module Helpers
    module CacheHelper
      private
      def fragment_for(name = {}, options = nil, &block) #:nodoc:
        if fragment = controller.read_fragment(name, options)
          fragment
        else
          # VIEW TODO: Make #capture usable outside of ERB
          # This dance is needed because Builder can't use capture
          pos = output_buffer.length
          yield
          output_safe = output_buffer.html_safe?
          fragment = output_buffer.slice!(pos..-1)
          if output_safe
            self.output_buffer = output_buffer.class.new(output_buffer)
          end

          # BEGIN MODIFIED CODE
          annotated_fragment = "<!-- Begin Cache: #{ActiveSupport::Cache.expand_cache_key(name)} at #{Time.zone.now} -->\n" << fragment << "\n<!-- End Cache: #{ActiveSupport::Cache.expand_cache_key(name)} -->\n"

          controller.write_fragment(name, annotated_fragment, options)
        end
      end
    end
  end
end
```

and then you will see HTML comments like this around cached content:

`<!-- Begin Cache: v3/right-sidebar at 2012-11-10 18:49:33 -0800 -->`

`<p>Some cached content here</p>`

`<!-- End Cache: v3/right-sidebar -->`

This makes it easy to see whats happening and track down any issues. It is worth noting that this is a very brittle mod, if new versions of Rails change how things work internally this will probably blow up in your face. You have been warned.
