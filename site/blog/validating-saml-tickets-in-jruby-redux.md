---
title: 'Validating SAML Tickets in JRuby Redux'
date: 2013-09-18
featured_image: /images/blog/validating-saml-tickets-in-jruby-redux.jpg
image_caption: Photo by Kaz at Pixabay
tags:
  - blog
  - jruby
---

A while back I had the pleasure o_O of implementing [SAML in JRuby](/blog/validating-saml-tickets-in-jruby/). At that time I was working with Java1.7.0u17, and all was right with the world.

Recently I wanted to upgrade to Java1.7.0u40, and the Validate class stopped working, and threw this error:

`Exception:javax.xml.crypto.URIReferenceException: com.sun.org.apache.xml.internal.security.utils.resolver.ResourceResolverException: Cannot resolve element with ID _673ef297-23ab-428c-8e11-7fed395a7daf`

Hmm. Something has obviously changed. A Google session later, this [bug report](https://issues.apache.org/jira/browse/SANTUARIO-312) points me in the right direction. It turns out that Java used to assume any XML node with an attribute named "ID" was in fact an ID node and could be found with `getElementById`. But newer versions conform more closely to the XML spec and require the node to be "tagged" as an ID node via a schema.

OK, so we change the code ([original here](/blog/validating-saml-tickets-in-jruby/)) to apply the correct schema:

### Validator.java

```java
    // Snip...

    SchemaFactory schemaFactory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
    Schema schema = schemaFactory.newSchema(new URL("http://docs.oasis-open.org/security/saml/v2.0/saml-schema-protocol-2.0.xsd"));
    DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
    dbf.setNamespaceAware(true);
    dbf.setSchema(schema);
    Document doc = dbf.newDocumentBuilder().parse(new InputSource(new StringReader(samlResponse)));

    // Snip..
```

This actually works and validates the SAML XML response, but it takes 30+ seconds to do it. Maybe thats because its trying to grab the schema from the web? So I try using a local copy, and still it takes 30+ seconds to run. Drat.

Since there is more than one way to shave a yak, instead of using a schema, you can also programmatically tag nodes to be ID nodes. So lets see what that looks like:

### Validator.java

```java
    // Snip...

    DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
    dbf.setNamespaceAware(true);
    Document doc = dbf.newDocumentBuilder().parse(new InputSource(new StringReader(samlResponse)));

    // Loop through the doc and tag every element with an ID attribute as an XML ID node.
    XPath xpath = XPathFactory.newInstance().newXPath();
    XPathExpression expr = xpath.compile("//*[@ID]");
    NodeList nodeList = (NodeList) expr.evaluate(doc, XPathConstants.NODESET);
    for (int i=0; i<nodeList.getLength() ; i++) {
      Element elem = (Element) nodeList.item(i);
      Attr attr = (Attr) elem.getAttributes().getNamedItem("ID");
      elem.setIdAttributeNode(attr, true);
    }

    // Snip..
```

Viola! This works, and of course its super fast.
