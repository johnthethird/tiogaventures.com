---
title: 'Test objects for blankness with this one little trick!'
date: 2014-08-24
featured_image: /images/blog/test-objects-for-blankness.jpg
image_caption: Photo by Dylan Gillis on Unsplash
excerpt: XXX
tags:
  - blog
  - rails
---

Rails adds a lot of syntactic sugar to plain old Ruby. A lot of this is wrapped up in the ActiveSupport module. If you work with Rails, and have not read ActiveSuport core_ext from cover to cover, stop now, and go [do it](https://github.com/rails/rails/tree/master/activesupport/lib/active_support/core_ext). Go on, I'll wait.

OK, I sense a few lightbulbs coming on out there! "So _thats why_ ..."

It seems most Rails folks know about (and use) `Object#blank?` and `Object#present?`. These are handy ways to test if something is, well, blank or not. Ruby thinks `nil` is `false`, which is great, but when dealing with web apps and user entered data, you might get an empty string or a bunch of space characters, which you also want to think of as `false`, perhaps so you can set a default value or something. Continually having to check for different types of blankness is annoying, so instead you can use `Object#blank?`

```ruby
user.country = params[:country].blank? ? 'USA' : params[:country]
# or, alternatively
user.country = params[:country].present? ? params[:country] : 'USA'
```

Now, that still looks a bit ugly, to a rubyist's eyes, so we can use `Object#presence` ([github](https://github.com/rails/rails/blob/master/activesupport/lib/active_support/core_ext/object/blank.rb#L43)) to clean it up even more:

```ruby
user.country = params[:country].presense || 'USA'
```

`#presence` will either return the value if it is not blank, OR nil. This also works with arrays and hashes as well.

Its a small thing, but neatly encapsulates a common pattern, and isn't that pretty much what we get paid to do all day?
