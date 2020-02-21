---
title: 'React JSX Transformer in Rails Middleware'
date: 2014-01-12
featured_image: /images/blog/react-jsx-transformer-middleware.jpg
tags:
  - blog
  - react
  - rails
---

Just because you can, doesn't mean you should.

Recently I been having a blast playing around with [React](http://facebook.github.io/react/), and I found this neat hack from [@ssorallen](https://twitter.com/ssorallen?rel=author) called [Reactize](https://turbo-react.herokuapp.com/).

What he is doing is grabbing the HTML response from the server, and then in the browser running the JSXTransformer on the HTML, and mounting the whole document body as a React component. Very clever!

So to riff on that theme a little bit, here is a Rails middleware that will take the HTML page the server was going to send to the client, and replace it with the JSXTransformed version, which is basically a javascript snippet. So the "heavy-lifting" of the JSXTransformer is done server-side.

Another thing we can do is hash the result and throw it in the Rails cache, so we arent doing more work than we need to.

```ruby
class JsxMiddleware
  def initialize(app)
    @jsxcode = File.read("#{Rails.root}/app/assets/javascripts/JSXTransformer.js")
    @app = app
  end

  def call(env)
    status, headers, response = @app.call(env)
    if env['HTTP_X_JSX'].present?
      response.body = convert_to_jsx(response.body[/<body>(.*)<\/body>/m,1])
      headers['X-JSX'] = 'true'
    end
    [status, headers, response]
  end

  def jsx_context
    # Use a Thread-local variable to store the JS context, with the JSXTransformer code loaded.
    # That way each thread will have its own and we are thread-safe.
    Thread.current[:jsx_context] ||= begin
      ExecJS.compile("global={};" + @jsxcode)
    end
  end

  def convert_to_jsx(html="")
    snippet = "/** @jsx React.DOM */\n" + html
    hash = Digest::MD5.hexdigest(snippet)
    Rails.cache.fetch "jsx:#{hash}" do
      jsx_context.call("global.JSXTransformer.transform", snippet)['code']
    end
  end
end
```

So on the client, have a link that looks like `<a href="/thepage" data-behavior="getViaJSX">Click Me</a>` and you could do something like this to request a JSXTransformed page...

```coffeescript
$ ->
  $("[data-behavior='getViaJSX']").on "click", (e) ->
    e.preventDefault()
    $.ajax
      url: e.target.href
      # The middleware only kicks in if this header exists
      headers: {'X-JSX': true}
      success: (data) ->
        component = eval(data)
        React.renderComponent(component, document.body)
```

Another option would be to bake it in to TurboLinks itself by patching it to make the request with the `X-JSX` header.

That's it! Not sure exactly what it is good for, but a fun exercise anyway.
