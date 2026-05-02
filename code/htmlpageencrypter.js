const crypto = require("crypto");
const fs = require("fs");
const numberofiterations = 1000000;

//old way to encrypt just one page
//const password = "idontwantanyonetobeabletoreadthispage";
//const html = fs.readFileSync("lockedpage.html", "utf8");

//encrypting multiple pages
const pages = [
  { file: "lockedpage.html", password: "REDACTED" },
  { file: "lockedpage2.html", password: "REDACTED2" },
  { file: "lockedpage3.html", password: "REDACTED3" }
];

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, numberofiterations, 32, "sha256");
}

function encrypt(text, password, salt) {
  const iv = crypto.randomBytes(12);
  //const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
    //salt: salt.toString("base64")
  };
}

//old way to encrypt only one page
//const encrypted = encrypt(html, password);
//fs.writeFileSync("secure.json", JSON.stringify(encrypted, null, 2));

const data = [];
const salt = crypto.randomBytes(16);

for (const p of pages) {
  const html = fs.readFileSync(p.file, "utf8");
  const encrypted = encrypt(html, p.password, salt);
  data.push(encrypted);
}

const output = {
  salt: salt.toString("base64"),
  iterations: numberofiterations,
  data: data,
}

//commented this out so I don't accidentally destroy my data by running this
//fs.writeFileSync("secure.json", JSON.stringify(output, null, 2));