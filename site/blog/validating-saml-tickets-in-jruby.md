---
title: 'Validating SAML Tickets in JRuby'
date: 2013-03-24
featured_image: /images/blog/validating-saml-tickets-in-jruby.jpg
image_caption: Photo by qimono at Pixabay
tags:
  - blog
  - jruby
---

**UPDATE** This has problems with newer Java versions. A solution is [here](/blog/validating-saml-tickets-in-jruby-redux/).

Implementing [SAML](http://en.wikipedia.org/wiki/SAML_2.0) is an effort in frustration and should be avoided at all costs. However, if you have the unenviable task of doing so, you may enjoy this little tale of misery, which fortunately does have a happy ending.

Let's say you want to implement a Single-Sign-On (SSO) solution for your Rails app, and SAML is the protocol you are going to use. If you are running MRI Ruby, then everything is peachy, and you actually have some really good choices. My favorite is [Samlr](https://github.com/zendesk/samlr) by Morten Primdahl from [Zendesk](http://www.zendesk.com). It is a well-architected gem that implements the parts of SAML you would care about for the standard use-cases of integrating with Microsoft's ADFS or [OneLogin](http://www.onelogin.com) or [Okta](http://www.okta.com).

If you are using [Omniauth](https://github.com/intridea/omniauth) then there is a nice little gem to hook everything together [omniauth-samlr](https://github.com/johnthethird/omniauth-samlr).

Under the covers, Samlr, and a lot of other SAML implementations for Ruby, use Nokogiri to work with the XML. This will be important later in our story.

Now, if you are deploying your Rails app on Torquebox (and really, why wouldn't you?), that means you are running in JRuby land. Usually this is not a problem. But it this case, it is. But first, a little background.

The SAML protocol relies on your browser passing around XML documents to different parties to verify your identity. Portions of the XML are cryptographically signed to prevent tampering. This is done according to the [XML-Signature](http://en.wikipedia.org/wiki/XML_Signature) spec. However, due to the way XML is processed, each party needs to make sure they sign the exact same XML document or snippet with the same ordering of attributes, same whitespace handling, same namespace declarations, etc etc. This process is called [Canonicalization](www.w3.org/TR/xml-c14n).

Whew. So now we know enough to understand why this little Nokogiri bug (or rather, incomplete feature) is going to cause us problems with SAML. Nokogiri [Issue #808](https://github.com/sparklemotion/nokogiri/issues/808), which says that Canonicalization (sometimes referred to as C14N) is broken in the JRuby version.

OK, so we are stymied. But wait! We are running on JRuby, right? That means we have access to a whole universe of Enterprise-y java goodness. In fact, the "gold standard" for implementing XML Signature is the JSR-105 API. So lets use that, shall we?

First, let's take a look at a SAML response ticket, which usually looks something like this:

### saml_response.xml

```xml
<?xml version="1.0"?>
<samlp:Response Destination="https://example.org/saml/endpoint" ID="samlr123" InResponseTo="samlr789" IssueInstant="2012-08-07T22:42:45Z" Version="2.0" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
    <saml:Issuer>ResponseBuilder IdP</saml:Issuer>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        <SignedInfo>
            <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
            <Reference URI="#samlr123">
                <Transforms>
                    <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                    <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
                        <InclusiveNamespaces PrefixList="#default samlp saml ds xs xsi" xmlns="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                    </Transform>
                </Transforms>
                <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                <DigestValue>qrDVhkkXlV9eA32p/l6NcQbkCJc=</DigestValue>
            </Reference>
        </SignedInfo>
        <SignatureValue>HVd+DQCgPO4YVS0q8iL1HR7Hh8v0J4Z7qg4vANzFoYhgEXnoOym2Ynntvb7ugTu4B41G0B5Rx7DGP2fTrZ3qyA==</SignatureValue>
        <KeyInfo>
            <X509Data>
                <X509Certificate>MIIBjTCCATegAwIBAgIBATANBgkqhkiG9w0BAQUFADBPMQswCQYDVQQGEwJVUzEUMBIGA1UECgwLZXhhbXBsZS5vcmcxHTAbBgNVBAsMFFphbWwgUmVzcG9uc2VCdWlsZGVyMQswCQYDVQQDDAJDQTAeFw0xMjA4MDgwMjAxMDlaFw0zMjA4MDMwMjAxMTRaME8xCzAJBgNVBAYTAlVTMRQwEgYDVQQKDAtleGFtcGxlLm9yZzEdMBsGA1UECwwUWmFtbCBSZXNwb25zZUJ1aWxkZXIxCzAJBgNVBAMMAkNBMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALb9pPmyHrbZJMDLLkVsHzzXvP7DFcPiYdaNU50l5znRr8ZGhwRZFAwKroOxXwhK5e9lz06C+kGqnL1v10h1BEUCAwEAATANBgkqhkiG9w0BAQUFAANBAKU10RznL2p7xRhO9vOh0CY+gWYmT2kbkLTVRYLApghQFAW8EzIHC/NggfEHM554ykzbbPwjSvM7cRBBDHYuWoY=</X509Certificate>
            </X509Data>
        </KeyInfo>
    </Signature>
    <samlp:Status>
        <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
    </samlp:Status>
    <saml:Assertion ID="samlr456" IssueInstant="2012-08-07T22:42:45Z" Version="2.0" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
        <saml:Issuer>ResponseBuilder IdP</saml:Issuer>
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
            <SignedInfo>
                <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
                <Reference URI="#samlr456">
                    <Transforms>
                        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                        <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#">
                            <InclusiveNamespaces PrefixList="#default samlp saml ds xs xsi" xmlns="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                        </Transform>
                    </Transforms>
                    <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                    <DigestValue>2W5OKvcKDQHoXRpku9S57Q0uUME=</DigestValue>
                </Reference>
            </SignedInfo>
            <SignatureValue>Fi2qxMs0Nf05Iz5NY/eW1Q7/pIn4BY7bHAbBeJGr+dShNPG35vkp16HpeLmrK2fOjgE6sdYxVsbOpsJ6j9pYbQ==</SignatureValue>
            <KeyInfo>
                <X509Data>
                    <X509Certificate>MIIBjTCCATegAwIBAgIBATANBgkqhkiG9w0BAQUFADBPMQswCQYDVQQGEwJVUzEUMBIGA1UECgwLZXhhbXBsZS5vcmcxHTAbBgNVBAsMFFphbWwgUmVzcG9uc2VCdWlsZGVyMQswCQYDVQQDDAJDQTAeFw0xMjA4MDgwMjAxMDlaFw0zMjA4MDMwMjAxMTRaME8xCzAJBgNVBAYTAlVTMRQwEgYDVQQKDAtleGFtcGxlLm9yZzEdMBsGA1UECwwUWmFtbCBSZXNwb25zZUJ1aWxkZXIxCzAJBgNVBAMMAkNBMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALb9pPmyHrbZJMDLLkVsHzzXvP7DFcPiYdaNU50l5znRr8ZGhwRZFAwKroOxXwhK5e9lz06C+kGqnL1v10h1BEUCAwEAATANBgkqhkiG9w0BAQUFAANBAKU10RznL2p7xRhO9vOh0CY+gWYmT2kbkLTVRYLApghQFAW8EzIHC/NggfEHM554ykzbbPwjSvM7cRBBDHYuWoY=</X509Certificate>
                </X509Data>
            </KeyInfo>
        </Signature>
        <saml:Subject>
            <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">someone@example.org</saml:NameID>
            <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
                <saml:SubjectConfirmationData InResponseTo="samlr789" NotOnOrAfter="2012-08-07T22:43:45Z" Recipient="https://example.org/saml/endpoint"/>
            </saml:SubjectConfirmation>
        </saml:Subject>
        <saml:Conditions NotBefore="2012-08-07T22:41:45Z" NotOnOrAfter="2012-08-07T22:43:45Z">
            <saml:AudienceRestriction>
                <saml:Audience>example.org</saml:Audience>
            </saml:AudienceRestriction>
        </saml:Conditions>
        <saml:AuthnStatement AuthnInstant="2012-08-07T22:42:45Z" SessionIndex="samlr456">
            <saml:AuthnContext>
                <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef>
            </saml:AuthnContext>
        </saml:AuthnStatement>
        <saml:AttributeStatement>
            <saml:Attribute Name="tags">
                <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">mean horse</saml:AttributeValue>
            </saml:Attribute>
            <saml:Attribute Name="things">
                <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">one</saml:AttributeValue>
                <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">two</saml:AttributeValue>
                <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">three</saml:AttributeValue>
            </saml:Attribute>
        </saml:AttributeStatement>
    </saml:Assertion>
</samlp:Response>
```

So, we whip up (and by "whip up", I mean hours of trawling the web, skimming hundreds of pages of specs and docs, and cargo-culting just enough code to work) a Java class that is a command line tool as well as exposing a method for our Ruby code to call. It will be a simple function that will validate the signatures on our SAML response.

### Validator.java

```java
import javax.xml.crypto.*;
import javax.xml.crypto.dsig.*;
import javax.xml.crypto.dom.*;
import javax.xml.crypto.dsig.dom.DOMValidateContext;
import javax.xml.crypto.dsig.keyinfo.*;
import java.io.FileInputStream;
import java.security.*;
import java.security.cert.*;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import java.io.StringReader;
import java.io.File;
import java.util.Scanner;
/**
 * Validating an XML Signature using the JSR 105 API. It assumes the key needed to
 * validate the signature is contained in a KeyInfo node.
 */
public class Validator {

    //
    // Synopsis: java Validator [document]
    //
    //    where "document" is the name of a file containing the XML document
    //    to be validated.
    //
    public static void main(String[] args) throws Exception {
        String samlResponse = new String(readFile(args[0]));
        System.out.println("Valid?: " + validate(samlResponse));
    }

    // Validator.validate(saml_response) returns boolean indicating if the doc has been validated
    public static boolean validate(String samlResponse) {
        boolean coreValidity = false;
        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setNamespaceAware(true);
            Document doc = dbf.newDocumentBuilder().parse(new InputSource(new StringReader(samlResponse)));

            // Find Signature element
            NodeList nl = doc.getElementsByTagNameNS(XMLSignature.XMLNS, "Signature");
            if (nl.getLength() == 0) {
                throw new Exception("Cannot find Signature element");
            }

            // Create a DOM XMLSignatureFactory that will be used to unmarshal the
            // document containing the XMLSignature
            XMLSignatureFactory fac = XMLSignatureFactory.getInstance("DOM");

            // Create a DOMValidateContext and specify a KeyValue KeySelector
            // and document context
            DOMValidateContext valContext = new DOMValidateContext(new RawX509KeySelector(), nl.item(0));

            XMLSignature signature = fac.unmarshalXMLSignature(valContext);

            // Validate the XMLSignature (generated above)
            coreValidity = signature.validate(valContext);
        } catch (Exception ex) {
            System.out.println("[SAML Validator] Exception:" + ex.getMessage());
            coreValidity = false;
        }
        // // Check core validation status
        // if (coreValidity == false) {
        //     System.err.println("Signature failed core validation");
        //     boolean sv = signature.getSignatureValue().validate(valContext);
        //     System.out.println("signature validation status: " + sv);
        //     // check the validation status of each Reference
        //     Iterator i = signature.getSignedInfo().getReferences().iterator();
        //     for (int j=0; i.hasNext(); j++) {
        //         boolean refValid =
        //             ((Reference) i.next()).validate(valContext);
        //         System.out.println("ref["+j+"] validity status: " + refValid);
        //     }
        // } else {
        //     System.out.println("Signature passed core validation");
        // }
        return coreValidity;
    }

    /**
     * KeySelector which would retrieve the X509Certificate out of the
     * KeyInfo element and return the public key.
     * NOTE: If there is an X509CRL in the KeyInfo element, then revoked
     * certificate will be ignored.
     */
    public static class RawX509KeySelector extends KeySelector {

        public KeySelectorResult select(KeyInfo keyInfo,
                                        KeySelector.Purpose purpose,
                                        AlgorithmMethod method,
                                        XMLCryptoContext context)
            throws KeySelectorException {
            if (keyInfo == null) {
                throw new KeySelectorException("Null KeyInfo object!");
            }
            // search for X509Data in keyinfo
            Iterator<?> iter = keyInfo.getContent().iterator();
            while (iter.hasNext()) {
                XMLStructure kiType = (XMLStructure) iter.next();
                if (kiType instanceof X509Data) {
                    X509Data xd = (X509Data) kiType;
                    Object[] entries = xd.getContent().toArray();
                    X509CRL crl = null;
                    // Looking for CRL before finding certificates
                    for (int i = 0; (i < entries.length && crl == null); i++) {
                        if (entries[i] instanceof X509CRL) {
                            crl = (X509CRL) entries[i];
                        }
                    }
                    Iterator<?> xi = xd.getContent().iterator();
                    while (xi.hasNext()) {
                        Object o = xi.next();
                        // skip non-X509Certificate entries
                        if (o instanceof X509Certificate) {
                            if ((purpose != KeySelector.Purpose.VERIFY) &&
                                (crl != null) &&
                                crl.isRevoked((X509Certificate)o)) {
                                continue;
                            } else {
                                return new SimpleKeySelectorResult
                                    (((X509Certificate)o).getPublicKey());
                            }
                        }
                    }
                }
            }
            throw new KeySelectorException("No X509Certificate found!");
        }
    }

    private static class SimpleKeySelectorResult implements KeySelectorResult {
        private PublicKey pk;
        SimpleKeySelectorResult(PublicKey pk) {
            this.pk = pk;
        }

        public Key getKey() { return pk; }
    }

    private static String readFile(String pathname) throws Exception {
        File file = new File(pathname);
        StringBuilder fileContents = new StringBuilder((int)file.length());
        Scanner scanner = new Scanner(file);
        String lineSeparator = System.getProperty("line.separator");

        try {
            while(scanner.hasNextLine()) {
                fileContents.append(scanner.nextLine() + lineSeparator);
            }
            return fileContents.toString();
        } finally {
            scanner.close();
        }
    }
}

```

You will also need this jar file [xmlsec-1.5.3](http://mvnrepository.com/artifact/org.apache.santuario/xmlsec/1.5.3) which contains the JSR-105 API.

You can compile the code with `javac Validator`, and run it with `java Validator saml_response.xml`

The really cool part, since we are running on the JVM anyway, is that you can call this from your JRuby code, like this:

```
#!/bin/env jruby
# Tell JRuby where your xmlsec jar file is by appending a path to CLASSPATH...
$CLASSPATH << File.join(File.dirname(__FILE__))
import "Validator"


saml_response = File.read("saml_response.xml")
Validator.validate(saml_response)
```

So now that we have a way of validating the signatures, we can patch Samlr to use this function when running under JRuby. It's a hack, but it works. The patched gem is [here](https://github.com/johnthethird/samlr/tree/kaleo), and the relevant part is here:

### signature.rb

```ruby
if RUBY_ENGINE == 'jruby'
  $CLASSPATH << File.join(File.dirname(__FILE__))
  import "Validator"
end

module Samlr
  class Signature
  ...
    def verify!
      raise SignatureError.new("No signature at #{prefix}/ds:Signature") unless present?

      verify_fingerprint! unless options[:skip_fingerprint]

      # HACK since Nokogiri doesnt support C14N under JRuby.
      # So we use the Validate.java class to do the validation using JSR-105 API in xmlsec-1.5.3.jar
      if RUBY_ENGINE == 'jruby'
        unless Validator.validate(@original.to_s)
          raise SignatureError.new("Signature validation error (java).")
        end
      else
        verify_digests!
        verify_signature!
      end

      true
    end
  ...
  end
end
```

So thats it! I hope someone out there will find this useful. And yes, I am well aware of the irony of using the Java superpowers of JRuby to work around a problem that only occurs if you are running on JRuby.
