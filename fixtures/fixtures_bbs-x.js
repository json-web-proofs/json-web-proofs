const {
    generateBls12381G2KeyPair,
    blsSign,
    blsVerify,
    blsCreateProof,
    blsVerifyProof,
  } = require('@mattrglobal/bbs-signatures');

const { fromKeyLike } = require('jose/jwk/from_key_like');
const { generateKeyPair } = require('jose/util/generate_key_pair');
const { calculateThumbprint } = require('jose/jwk/thumbprint');
const { encode, decode } = require('jose/util/base64url');
const { readFileSync, writeFileSync } = require('fs');
const { GeneralSign } = require('jose/jws/general/sign');
const { randomBytes } = require('crypto');

const keyPair = {
    publicKey: new Uint8Array([
        179, 209, 122,  60, 230,  37, 188,  86,  19,  19,   4,  36,
        240, 230,  79, 178, 230, 147,   9,  60, 239,  41, 233, 167,
        190, 252, 154,  35,  39, 201, 238,  73,  77, 228,  20,  47,
        109, 174,  15, 168, 187, 145, 126,  85,  83, 151,  48,  30,
         13, 237,  92, 179, 124, 181, 211, 204, 187, 222, 229, 234,
        182,  94,  60, 157,  19, 148, 162,  48, 185, 134, 177, 168,
         68, 115, 167,  48,  92, 181, 168,  53,  52, 246, 201, 112,
        103,  23, 159, 138, 225,  13, 165, 171, 251, 112, 163,  96
      ]),
    secretKey:new Uint8Array([
        72, 125, 227,  97, 150, 148, 186, 145,
       110,  46, 135, 232, 104, 204, 128, 242,
        73, 151,  72, 162,   0,  54, 139, 146,
       221, 137,  34,  74,   1,  42, 140, 206
     ])
}

let jpa_fix = {}
try {
    jpa_fix = JSON.parse(readFileSync('draft-jmiller-jose-json-proof-algorithms.json'))
}catch(E){
    console.error(`fixture file loading error:`, E);
    process.exit(1)
}

function octet_array(value)
{
    if(value instanceof Uint8Array) value = Array.from(value);
    if(!Array.isArray(value)) value = Array.from(new TextEncoder("utf-8").encode((value)));
    return JSON.stringify(value).split(',').join(', ')
}

(async function(){
    // generate the long-term public key
    //const keyPair = await generateBls12381G2KeyPair();

    const jwk = {};
    jwk.kty = 'OKP';
    jwk.crv = 'Bls12381G2';
    jwk.x = Buffer.from(keyPair.publicKey).toString('base64url');
    jwk.kid = await calculateThumbprint(jwk);
    jwk.alg = 'BBS+';
    jwk.use = 'proof';
    console.log('JWK:');
    console.log(JSON.stringify(jwk,0,2));
    console.log('pub', octet_array(keyPair.publicKey));
    console.log('priv', octet_array(keyPair.secretKey));
    jpa_fix.bbs_issuer_public_octets = JSON.parse(octet_array(keyPair.publicKey));
    jpa_fix.bbs_issuer_private_octets = JSON.parse(octet_array(keyPair.secretKey));

    // generate jwp
    const jwp = {};
    const protected = {};
    protected.iss = 'https://issuer.example';
    protected.claims = ['family_name', 'given_name', 'email', 'age']
    protected.typ = 'JPT';
    protected.alg = 'BBS-X';
    jwp.protected = encode(JSON.stringify(protected));
    console.log();
    console.log('Protected Header:');
    console.log(JSON.stringify(protected, 0, 2));
//    console.log('octets:', octet_array(JSON.stringify(protected)));
//    console.log('encoded:', jwp.protected);
    jpa_fix.bbs_issuer_protected_header = protected;

    const protected_buff = Buffer.from(JSON.stringify(protected), 'utf8');
    jwp.protected = encode(protected_buff);
    const payloads_buff = [
        Buffer.from(JSON.stringify('Doe'), 'utf8'),
        Buffer.from(JSON.stringify('Jay'), 'utf8'),
        Buffer.from(JSON.stringify('jaydoe@example.org'), 'utf8'),
        Buffer.from(JSON.stringify(42), 'utf8')
    ];
    jwp.payloads = payloads_buff.map(encode);
    
    let messages = [];
    messages.push(Uint8Array.from(protected_buff));
    messages = messages.concat(payloads_buff.map((item)=>Uint8Array.from(item)));
    const signature = await blsSign({
        keyPair,
        messages
    });

    let x = messages.map((item)=>Array.from(item))
    console.log('messages',JSON.stringify(x).split(',').join(', '))
    jpa_fix.bbs_issuer_messages = x;
    console.log('signature', octet_array(signature));
    jpa_fix.bbs_issuer_signature = JSON.parse(octet_array(signature));
  
    jwp.proof = encode(signature);
    console.log()
    console.log('JSON Serialization:');
    console.log(JSON.stringify(jwp,0,2));
    jpa_fix.bbs_issued_jwp = JSON.parse(JSON.stringify(jwp)); // copy

    const serialized = [];
    serialized.push(encode(JSON.stringify(jwp.protected)));
    serialized.push(jwp.payloads.join('~'));
    serialized.push(jwp.proof);
    console.log()
    console.log('Compact Serialization:');
    console.log(serialized.join('.'));
    jpa_fix.bbs_issued_compact = serialized.join('.');

    // generate a proof with selective disclosure of only the name and age
    const nonce = randomBytes(32);
    console.log('nonce', octet_array(nonce));
    jpa_fix.bbs_present_nonce = JSON.parse(octet_array(nonce));

    const proof = await blsCreateProof({
        signature,
        publicKey: keyPair.publicKey,
        messages,
        nonce: Uint8Array.from(nonce),
        revealed: [0,2,4],
    });
    console.log('proof', octet_array(proof));
    jpa_fix.bbs_present_proof = JSON.parse(octet_array(proof));

    jwp.payloads[0] = null;
    jwp.payloads[2] = null;
    jwp.proof = encode(proof);
    console.log('JSON Serialization:');
    console.log(JSON.stringify(jwp,0,2));
    jpa_fix.bbs_present_jwp = JSON.parse(JSON.stringify(jwp));

    jwp.payloads[0] = '';
    jwp.payloads[2] = '';
    const presentation = [];
    presentation.push(encode(JSON.stringify(jwp.protected)));
    presentation.push(jwp.payloads.join('~'));
    presentation.push(encode(proof));
    console.log()
    console.log('Compact Presentation:');
    console.log(presentation.join('.'));
    jpa_fix.bbs_present_compact = presentation.join('.');
      
    writeFileSync('draft-jmiller-jose-json-proof-algorithms.json', JSON.stringify(jpa_fix, 0, 2))

})();
