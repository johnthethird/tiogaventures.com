---
title: 'Greasemonkey for IE'
date: 2013-01-08
featured_image: /images/blog/greasemonkey-for-ie.jpg
image_caption: Photo by Jia Ye on Unsplash
tags:
  - blog
  - enterprise
---

Recently, I needed to inject a bit of Javascript into every web page. If I were using a modern browser, this would have been a non-issue. Chrome/Safari/Firefox all have plug-in architectures that allow for easy custom mods. Unfortunately, I needed to do this for IE. After much searching around, it seems that there are really no good solutions to this problem for Internet Explorer. There use to be a thing called Trixie that puportedly ran Greasemonkey scripts, but its website is defunct. There is also [IE7Pro](http://www.ie7pro.com) which is a massively invasive extension and not suitable for our simple requirement.

So, looks like we have to whip one up ourselves. How hard could that be, right? Turns out it's annoying, excruciatingly difficult. The fine folks at [Add-In-Express](http://www.add-in-express.com) make things a lot easier. So, you will need [this](http://www.add-in-express.com/programming-internet-explorer/index.php) product to follow along.

The goal is simple, inject an arbitrary snippet of Javascript into every web page visited by the browser. To do this, fire up Visual Studio and create a new project from the Add In Express templates.

<img href="/images/blog/CreateAIEProject.jpg" />

I would suggest targeting .NET Framework 3.5 instead of 4, since it is much more compatible. For example, try installing .NET 4.x on Windows Server 2008 R2 SP1. Go on, I dare ya!

Anyway, once that is done, we just need to add a few bits to the template that the AddInExpress folks so kindly made for us. Find the `IEModule.cs` file, and make it look something like this:

```csharp
using System;
using System.Runtime.InteropServices;
using System.ComponentModel;
using System.Windows.Forms;
using IE = Interop.SHDocVw;
using AddinExpress.IE;
using System.IO;
using mshtml;

namespace KaleoInjectorV2
{
    /// <summary>
    /// Add-in Express for Internet Explorer Module
    /// </summary>
    [ComVisible(true), Guid("2C8C66D2-0D13-4B46-871F-910B5ABC25AD")]
    public class IEModule : AddinExpress.IE.ADXIEModule
    {
        private String globalScript = "/* c:\\MyApp\\injector.js empty or not found. */";
        private Boolean globalScriptLoaded = false;

        public IEModule()
        {
            InitializeComponent();
            //Please write any initialization code in the OnConnect event handler
        }

        public IEModule(IContainer container)
        {
            container.Add(this);

            InitializeComponent();
            //Please write any initialization code in the OnConnect event handler
        }

        #region Component Designer generated code
        /// <summary>
        /// Required by designer
        /// </summary>
        private System.ComponentModel.IContainer components;

        /// <summary>
        /// Required by designer support - do not modify
        /// the following method
        /// </summary>
        private void InitializeComponent()
        {
            //
            // IEModule
            //
            this.HandleShortcuts = true;
            this.LoadInMainProcess = false;
            this.ModuleName = "MyApp";
            this.HandleDocumentUICommands = true;
            // Make our event handler run whenever the HTML document has completed loading
            this.DocumentComplete2 += new AddinExpress.IE.ADXIEDocumentComplete2_EventHandler(this.IEModule_DocumentComplete2);
        }
        #endregion

        #region ADX automatic code

        // Required by Add-in Express - do not modify
        // the methods within this region

        public override System.ComponentModel.IContainer GetContainer()
        {
            if (components == null)
                components = new System.ComponentModel.Container();
            return components;
        }

        [ComRegisterFunctionAttribute]
        public static void RegisterIEModule(Type t)
        {
            AddinExpress.IE.ADXIEModule.RegisterIEModuleInternal(t);
        }

        [ComUnregisterFunctionAttribute]
        public static void UnregisterIEModule(Type t)
        {
            AddinExpress.IE.ADXIEModule.UnregisterIEModuleInternal(t);
        }

        [ComVisible(true)]
        public class IECustomContextMenuCommands :
            AddinExpress.IE.ADXIEModule.ADXIEContextMenuCommandDispatcher
        {
        }

        [ComVisible(true)]
        public class IECustomCommands :
            AddinExpress.IE.ADXIEModule.ADXIECommandDispatcher
        {
        }

        #endregion

        public IE.WebBrowser IEApp
        {
            get
            {
                return (this.IEObj as IE.WebBrowser);
            }
        }

        public mshtml.HTMLDocument HTMLDocument
        {
            get
            {
                return (this.HTMLDocumentObj as mshtml.HTMLDocument);
            }
        }

        private void IEModule_DocumentComplete2(object pDisp, string url, bool rootDocLoaded)
        {
            if (rootDocLoaded && !String.IsNullOrEmpty(url) && !url.StartsWith("about:") && this.notInjectedYet())
            {
                this.loadGlobalScript();
                HTMLDocument doc = this.HTMLDocument;
                var head = doc.getElementsByTagName("head").item(null, 0) as mshtml.IHTMLElement;
                IHTMLScriptElement scriptObject = (IHTMLScriptElement)doc.createElement("script");
                ((IHTMLElement)scriptObject).id = @"myapp-injector";
                scriptObject.type = @"text/javascript";
                scriptObject.text = @"/* Injecting c:\MyApp\injector.js */  " + this.globalScript;
                ((HTMLHeadElement)head).appendChild((IHTMLDOMNode)scriptObject);

                Marshal.ReleaseComObject(scriptObject);
                Marshal.ReleaseComObject(head);
            }
        }

        private Boolean notInjectedYet()
        {
            HTMLDocument doc = this.HTMLDocument;
            IHTMLElement script = doc.getElementById("myapp-injector");
            return (script == null);
        }


        // Load the javascript from the file system. In this simple example we are just loading it from a hard-coded path
        private void loadGlobalScript()
        {
            if (!this.globalScriptLoaded)
            {
                try
                {
                    using (StreamReader sr = new StreamReader("C:\\MyApp\\injector.js"))
                    {
                        this.globalScript = sr.ReadToEnd();
                        this.globalScriptLoaded = true;
                    }
                }
                catch (Exception e)
                {
                    MessageBox.Show(@"MyApp Browser Extension Error reading C:\\MyApp\\injector.js -- " + e.Message);
                }
            }
        }

    }
}

```

And that's it. Add-In-Express will also generate a nice setup.exe package for you, which can be installed on any windows box and away you go. Once your custom javascript is injected into the page, you can do whatever you like using standard web technologies. Here is an example of what that might look like:

```javascript
// Injector.js

// Set regex used later to determine which pages we should run on.
INJECTOR_URL_REGEX = /google\.com/

// Include the handly yepnope library to conditionally load jQuery only if the current page doesnt already have it.
/*yepnope1.5.x|WTFPL*/
;(function(a, b, c) {
  function d(a) {
    return '[object Function]' == o.call(a)
  }
  function e(a) {
    return 'string' == typeof a
  }
  function f() {}
  function g(a) {
    return !a || 'loaded' == a || 'complete' == a || 'uninitialized' == a
  }
  function h() {
    var a = p.shift()
    ;(q = 1),
      a
        ? a.t
          ? m(function() {
              ;('c' == a.t ? B.injectCss : B.injectJs)(a.s, 0, a.a, a.x, a.e, 1)
            }, 0)
          : (a(), h())
        : (q = 0)
  }
  function i(a, c, d, e, f, i, j) {
    function k(b) {
      if (!o && g(l.readyState) && ((u.r = o = 1), !q && h(), (l.onload = l.onreadystatechange = null), b)) {
        'img' != a &&
          m(function() {
            t.removeChild(l)
          }, 50)
        for (var d in y[c]) y[c].hasOwnProperty(d) && y[c][d].onload()
      }
    }
    var j = j || B.errorTimeout,
      l = b.createElement(a),
      o = 0,
      r = 0,
      u = { t: d, s: c, e: f, a: i, x: j }
    1 === y[c] && ((r = 1), (y[c] = [])),
      'object' == a ? (l.data = c) : ((l.src = c), (l.type = a)),
      (l.width = l.height = '0'),
      (l.onerror = l.onload = l.onreadystatechange = function() {
        k.call(this, r)
      }),
      p.splice(e, 0, u),
      'img' != a && (r || 2 === y[c] ? (t.insertBefore(l, s ? null : n), m(k, j)) : y[c].push(l))
  }
  function j(a, b, c, d, f) {
    return (
      (q = 0),
      (b = b || 'j'),
      e(a) ? i('c' == b ? v : u, a, b, this.i++, c, d, f) : (p.splice(this.i++, 0, a), 1 == p.length && h()),
      this
    )
  }
  function k() {
    var a = B
    return (a.loader = { load: j, i: 0 }), a
  }
  var l = b.documentElement,
    m = a.setTimeout,
    n = b.getElementsByTagName('script')[0],
    o = {}.toString,
    p = [],
    q = 0,
    r = 'MozAppearance' in l.style,
    s = r && !!b.createRange().compareNode,
    t = s ? l : n.parentNode,
    l = a.opera && '[object Opera]' == o.call(a.opera),
    l = !!b.attachEvent && !l,
    u = r ? 'object' : l ? 'script' : 'img',
    v = l ? 'script' : u,
    w =
      Array.isArray ||
      function(a) {
        return '[object Array]' == o.call(a)
      },
    x = [],
    y = {},
    z = {
      timeout: function(a, b) {
        return b.length && (a.timeout = b[0]), a
      }
    },
    A,
    B
  ;(B = function(a) {
    function b(a) {
      var a = a.split('!'),
        b = x.length,
        c = a.pop(),
        d = a.length,
        c = { url: c, origUrl: c, prefixes: a },
        e,
        f,
        g
      for (f = 0; f < d; f++) (g = a[f].split('=')), (e = z[g.shift()]) && (c = e(c, g))
      for (f = 0; f < b; f++) c = x[f](c)
      return c
    }
    function g(a, e, f, g, h) {
      var i = b(a),
        j = i.autoCallback
      i.url
        .split('.')
        .pop()
        .split('?')
        .shift(),
        i.bypass ||
          (e &&
            (e = d(e)
              ? e
              : e[a] ||
                e[g] ||
                e[
                  a
                    .split('/')
                    .pop()
                    .split('?')[0]
                ]),
          i.instead
            ? i.instead(a, e, f, g, h)
            : (y[i.url] ? (i.noexec = !0) : (y[i.url] = 1),
              f.load(
                i.url,
                i.forceCSS ||
                  (!i.forceJS &&
                    'css' ==
                      i.url
                        .split('.')
                        .pop()
                        .split('?')
                        .shift())
                  ? 'c'
                  : c,
                i.noexec,
                i.attrs,
                i.timeout
              ),
              (d(e) || d(j)) &&
                f.load(function() {
                  k(), e && e(i.origUrl, h, g), j && j(i.origUrl, h, g), (y[i.url] = 2)
                })))
    }
    function h(a, b) {
      function c(a, c) {
        if (a) {
          if (e(a))
            c ||
              (j = function() {
                var a = [].slice.call(arguments)
                k.apply(this, a), l()
              }),
              g(a, j, b, 0, h)
          else if (Object(a) === a)
            for (n in ((m = (function() {
              var b = 0,
                c
              for (c in a) a.hasOwnProperty(c) && b++
              return b
            })()),
            a))
              a.hasOwnProperty(n) &&
                (!c &&
                  !--m &&
                  (d(j)
                    ? (j = function() {
                        var a = [].slice.call(arguments)
                        k.apply(this, a), l()
                      })
                    : (j[n] = (function(a) {
                        return function() {
                          var b = [].slice.call(arguments)
                          a && a.apply(this, b), l()
                        }
                      })(k[n]))),
                g(a[n], j, b, n, h))
        } else !c && l()
      }
      var h = !!a.test,
        i = a.load || a.both,
        j = a.callback || f,
        k = j,
        l = a.complete || f,
        m,
        n
      c(h ? a.yep : a.nope, !!i), i && c(i)
    }
    var i,
      j,
      l = this.yepnope.loader
    if (e(a)) g(a, 0, l, 0)
    else if (w(a))
      for (i = 0; i < a.length; i++) (j = a[i]), e(j) ? g(j, 0, l, 0) : w(j) ? B(j) : Object(j) === j && h(j, l)
    else Object(a) === a && h(a, l)
  }),
    (B.addPrefix = function(a, b) {
      z[a] = b
    }),
    (B.addFilter = function(a) {
      x.push(a)
    }),
    (B.errorTimeout = 1e4),
    null == b.readyState &&
      b.addEventListener &&
      ((b.readyState = 'loading'),
      b.addEventListener(
        'DOMContentLoaded',
        (A = function() {
          b.removeEventListener('DOMContentLoaded', A, 0), (b.readyState = 'complete')
        }),
        0
      )),
    (a.yepnope = k()),
    (a.yepnope.executeStack = h),
    (a.yepnope.injectJs = function(a, c, d, e, i, j) {
      var k = b.createElement('script'),
        l,
        o,
        e = e || B.errorTimeout
      k.src = a
      for (o in d) k.setAttribute(o, d[o])
      ;(c = j ? h : c || f),
        (k.onreadystatechange = k.onload = function() {
          !l && g(k.readyState) && ((l = 1), c(), (k.onload = k.onreadystatechange = null))
        }),
        m(function() {
          l || ((l = 1), c(1))
        }, e),
        i ? k.onload() : n.parentNode.insertBefore(k, n)
    }),
    (a.yepnope.injectCss = function(a, c, d, e, g, i) {
      var e = b.createElement('link'),
        j,
        c = i ? h : c || f
      ;(e.href = a), (e.rel = 'stylesheet'), (e.type = 'text/css')
      for (j in d) e.setAttribute(j, d[j])
      g || (n.parentNode.insertBefore(e, n), m(c, 0))
    })
})(this, document)
;(function() {
  // Safe log function for IE
  function log(msg) {
    if (window['console'] !== undefined) {
      console.log(msg)
    }
  }

  if (!INJECTOR_URL_REGEX.test(document.location.href)) {
    log('Injector Not Activated. ' + document.location.href + ' does not match ' + INJECTOR_URL_REGEX)
  } else {
    log('Injector Activated. ' + document.location.href + ' matched ' + INJECTOR_URL_REGEX)
    yepnope({
      test: typeof jQuery == 'undefined',
      yep: ['https://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js'],
      both: ['http://mysite.com/my_custom_javascript.js'],
      complete: function() {
        log('Injector Completed')
      }
    })
  }
})()
```
