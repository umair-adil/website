const numberofiterations = 5000000; //PBKDF2 iterations; increase for better security or decrease for faster performance
const pages = [
  { file: "lockedpage.html", passwords: ["password1"] },
  { file: "lockedpage2.html", passwords: ["password2"] },
  { file: "lockedpage3.html", passwords: ["password3", "password4"] },
];

const crypto = require("crypto");
const fs = require("fs");

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, numberofiterations, 32, "sha256");
}

function encryptAESGCM(key, plaintext, inputEncoding = null) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = inputEncoding
    ? Buffer.concat([cipher.update(plaintext, inputEncoding), cipher.final()])
    : Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64")
  };
}

function encryptKeyWithPassword(mainKey, password, salt) {
  const key = deriveKey(password, salt);
  return encryptAESGCM(key, mainKey);
}

function encryptPageWithMainKey(mainKey, html){
  return encryptAESGCM(mainKey, html, "utf8");
}

const data = [];
const salt = crypto.randomBytes(16);

for (const p of pages) {
  const html = fs.readFileSync(p.file, "utf8"); //read the page
  const mainKey = crypto.randomBytes(32); //generate main key for encrypting this page
  const encryptedData = encryptPageWithMainKey(mainKey, html) //encrypt page with main key
  const wrappedKeys = p.passwords.map(password => encryptKeyWithPassword(mainKey, password, salt)); //encrypt main key with each valid password

  data.push({
    pageData: encryptedData,
    wrappedKeys: wrappedKeys
  });
}

const output = {
  salt: salt.toString("base64"),
  iterations: numberofiterations,
  data: data,
}

if (!fs.existsSync("secure.json")) {
  createJsonWithData();
  console.log("secure.json written");
}
else{
  console.error("ERROR: secure.json already exists. Refusing to continue to protect against overwriting data.");
  console.error("In order to continue, delete secure.json or move it somewhere else instead (backup recommended).");
}