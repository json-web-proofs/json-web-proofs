%%%
title = "JSON Proof Token"
abbrev = "json-proof-token"
ipr = "trust200902"
workgroup="jose"
keyword = ["jose", "zkp", "jwp", "jws", "jpt"]
docname = "draft-ietf-jose-json-proof-token"
consensus = true
tocdepth = 4

[seriesInfo]
name = "Internet-Draft"
value = "draft-ietf-jose-json-proof-token-latest"
stream = "IETF"
status = "standard"

[pi]
toc = "yes"

[[author]]
initials = "J."
surname = "Miller"
fullname = "Jeremie Miller"
organization = "Ping Identity"
  [author.address]
   email = "jmiller@pingidentity.com"

[[author]]
initials = "M."
surname = "Jones"
fullname = "Michael B. Jones"
organization = "Self-Issued Consulting"
  [author.address]
  email = "michael_b_jones@hotmail.com"
  uri = "https://self-issued.info/"

[[author]]
initials = "D."
surname = "Waite"
fullname = "David Waite"
organization = "Ping Identity"
  [author.address]
  email = "dwaite+jwp@pingidentity.com"

%%%

.# Abstract

JSON Proof Token (JPT) is a compact, URL-safe, privacy-preserving representation of claims to be transferred between three parties.  The claims in a JPT are encoded as base64url-encoded JSON objects that are used as the payloads of a JSON Web Proof (JWP) structure, enabling them to be digitally signed and selectively disclosed.  JPTs also support reusability and unlinkability when using Zero-Knowledge Proofs (ZKPs).

{mainmatter}

# Introduction

JSON Proof Token (JPT) is a compact claims representation format intended to be used in the same ways as a JSON Web Token (JWT), but with additional support for selective disclosure and unlinkability.  JPTs encode claim values to be transmitted as payloads of a JSON Web Proof (JWP) [@!I-D.ietf-jose-json-web-proof].  JPTs are always represented using the JWP Compact Serialization.  The corresponding claim names are not transmitted in the payloads and are stored in a separate structure that can be externalized and shared across multiple JPTs.

> Editor's Note: This draft is still early and incomplete. There will be significant changes to the algorithms as currently defined here.  Please do not use any of these definitions or examples for anything except personal experimentation and learning.  Contributions and feedback are welcomed at https://github.com/ietf-wg-jose/json-web-proof.

# Conventions and Definitions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED",
"MAY", and "OPTIONAL" in this document are to be interpreted as described in BCP 14 [@RFC2119] [@RFC8174] when, and only when, they appear in all capitals, as shown here.

# Background

JWP defines a container binding together a protected header, one or more payloads, and a cryptographic proof.  It does not define how claims are organized into payloads and what formats they are in.  JPTs are intended to be as close to a JWT as possible, while also supporting the selective disclosure and unlinkability of JWPs.

# Design Considerations

The rationale behind the design for JSON Proof Tokens is important when considering how it is structured.  These sections detail the underlying reasoning informing the JPT design.

## Unlinkability

Supporting unlinkability is perhaps the most challenging design constraint for JPTs.  Even the smallest oversight can introduce a subtle vector for relying parties to collude and correlate one or more subjects across their usage.

The principal tools to prevent this are data minimization and uniformity.  The data included in a JPT SHOULD be minimized to remove potential correlation points. The data SHOULD contain only values that are able to be selectively disclosed with consent or transformed by the proof algorithm when presented.

Any other data that is repeated across multiple JPTs is externalized so that it is uniform across every issuance.  This includes preventing the usage of optional headers, dynamic mapping of claims to payloads, changes to how many payloads are included, and the ordering of the payloads.

## Selective Disclosure

While JWPs provide the underling structure for easily supporting selective disclosure, JPTs must go a step further to ensure that holders can effectively provide choice and consent on exactly what is being disclosed.  Software using JWPs MUST know the mappings from payloads to claims. All disclosed payloads MUST be mapped to claims and made accessible to the application.  Holders SHOULD understand the semantics of all potentially disclosed claims to the extent needed to decide whether to disclose them. JPTs SHOULD NOT contain claims that are intended only for a specific verifier.

## Familiarity

JPTs are intended to be as close to a JWT as possible in order to provide the simplest transition for any JWT-based system to add support for JPTs.

Although there are some stark differences in the lifecycle of a JPT, from the application's perspective, the interface to a JPT can be made fairly similar: a JSON object containing a mix of required and optional claims with well-understood values.

The most significant divergence required by JPTs is that of supporting values that may be disclosed or may instead only be a proof about the value.  Applications are required to interact with the JPT on a payload-by-payload basis instead of just verifying a JWT and then being able to interact with the JSON body directly.

## Proofs

To generate a variety of efficient ZKPs of knowledge, range, membership, or other predicates, it is essential that each individual payload is only a single claim value.  This greatly simplifies the task of linking a derived proof of a given claim to the specific payload that was also signed by the issuer.  While JPTs support claims that have complex object or array compound values, they also allow for simple claim values such as JSON strings, numbers, and booleans that can be used directly in generating predicate proofs.

# Claim Names

It is RECOMMENDED that the claim names used with JPTs come from those in the IANA JSON Web Token Claims Registry [@IANA.JWT.Claims] established by [@!RFC7519], when those fit the application's needs.

# Claims

A JSON Proof Token assigns each playload a claim name. Payloads MUST each have a negotiated and understood claim name within the application context. The simplest solution to establish payload claim names is as an ordered array that aligns with the included payloads.  This claims array can be conveniently included in the Issuer Protected Header using the `claims` key.

All payloads are claim values and MUST be the base64url encoding of the UTF-8 representation of a JSON value.
That said, predicate proofs derived from payload values are not represented as claims;
they are contained in the presentation proof using algorithm-specific representations.

The following is an example JWP Issuer Protected Header that includes a claims property:

<{{./fixtures/template/jpt-issuer-protected-header-with-claims.json}}

In this example, the "iat" and "exp" would be JSON-formatted numbers, "family_name", "given_name" and "email" would be JSON strings (in quotes), "address" would be a JSON object and "age_over_21" would be expected to be either `true` or `false`.

# Claims ID ("cid") JWP Header Parameter {#cidDef}

A Claims ID ("cid") value can be used as an identifier for a set of claim names without explicitly listing them.
The structure of the `cid` value is unspecified.
Its value MUST be a case-sensitive string.
Use of this JWP Header Parameter is OPTIONAL.

The `cid` can be used similarly to a `kid` in order to ensure that is it possible to externally resolve and then verify that the correct list of claim names is being used when processing the payloads containing the claim values.

If there is an associated JWK containing the signing key information, the `claims` key is also registered there as a convenient location for the claim names.

When the claims array is transferred as a property in the Issuer Protected Header, any variations of that array between JWP will be visible to the verifier, and can leak information about the subject or provide an additional vector for linkability.  Given the privacy design considerations around linkability, it is RECOMMENDED that the claims are defined external to an individual JPT and either referenced or known by the application context.

The following is an example JWP Protected Header that includes a `cid`:

<{{./fixtures/template/jpt-issuer-protected-header-with-cid.json}}

# Payloads

> Editor's Note: This section is incomplete. Use it only as an indicator of the intended direction.

Application resolves each claim as required when processing the JPT.  Resolution can result in one of three things:
1. A disclosed JSON value
2. A custom proof method
3. A `null` value

## Disclosed

Always an octet string of valid JSON text.

## Proof Methods

* proof methods can be returned instead of a disclosed payload
* these are generated by the algorithm from information in the JWP's proof value
* a proof method may be custom based on the capabilities of the algorithm
* define common proof method types available?
  * range
  * membership
  * time
  * knowledge
  * linking

# Example JPT

See the [@!I-D.ietf-jose-json-web-proof] appendix.

# Security Considerations

* Protected Header Minimization

# IANA Considerations

## JSON Web Proof Header Parameters Registration {#HdrReg}

This section registers the following JWP Header Parameter in the
IANA "JSON Web Proof Header Parameters" registry
established by [@!I-D.ietf-jose-json-web-proof].

### Registry Contents {#HdrContents}

#### Claims ID Header Parameter

* Header Parameter Name: `cid`
* Header Parameter Description: Claims ID
* Header Parameter Usage Location(s): Issued, Presented
* Change Controller: IETF
* Specification Document(s): (#cidDef) of this specification


{backmatter}

<reference anchor="IANA.JWT.Claims" target="https://www.iana.org/assignments/jwt">
  <front>
    <title>JSON Web Token Claims</title>
    <author>
      <organization>IANA</organization>
    </author>
    <date/>
  </front>
</reference>

# Acknowledgements

This work was incubated in the DIF [Applied Cryptography Working Group](https://identity.foundation/working-groups/crypto.html).

We would like to thank
Brent Zundel
for his valuable contributions to this specification.

# Document History

  [[ To be removed from the final specification ]]

 -06

  * Update reference to new repository home

 -05

  * Define and register Claims ID JWP Header Parameter.

  -04

  * Refactoring figures and examples to be built from a common set across all three documents

  -03

  * Improvements resulting from a full proofreading.
  * Added examples of JSON object and JSON boolean claims.

  -02

  * Update example to use the current BBS algorithm

  -01

  * Correct cross-references within group.

  -00

  * Created initial working group draft based on draft-jmiller-jose-json-proof-token-01
