const crypto = require("crypto");
const fs = require("fs");

const password = "REDACTED";//password redacted for publishing script publicly 

// Load the full HTML file
const html = fs.readFileSync("lockedpage.html", "utf8"); //the html is private

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

function encrypt(text, password) {
  const iv = crypto.randomBytes(12);
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
    salt: salt.toString("base64")
  };
}

const encrypted = encrypt(html, password);

//commented out so that I don't destroy the data if I accidentally run this script
//fs.writeFileSync("secure.json", JSON.stringify(encrypted, null, 2));