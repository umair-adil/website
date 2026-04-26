const crypto = require("crypto");

const questions = [
  { q: "Question 1: \n\nWhat is 2 + 2?", a: "4" },
  { q: "Question 2: \n\nWhat is the domain name of this website?", a: "umairadil.com" },
  { q: "Question 3: \n\nWhat color is the sky?", a: "blue" },
  { q: "You are almost done. Enter the first character of each of the previous answers", a: "4ub" },
  { q: "You are done! Congratulations text for puzzle finishers is meant to go here", a: "done" }
];

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

const output = [];

// First question is plaintext
output.push({ plaintext: questions[0].q });

// Encrypt each next question using previous answer
for (let i = 1; i < questions.length; i++) {
  const prevAnswer = questions[i - 1].a;
  const encrypted = encrypt(questions[i].q, prevAnswer);
  output.push(encrypted);
}

console.log(JSON.stringify(output, null, 2));

//write to file
const fs = require("fs");

fs.writeFileSync("data.json", JSON.stringify(output, null, 2));