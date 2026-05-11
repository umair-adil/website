// HOW TO USE:
//
// Place your HTML files in the same folder/directory as this file (encrypter.js)
// Then run "node encrypter.js" in that same folder/directory
// Follow the instructions on the console to add all the pages and passwords
// Finally, publish the index.html, decryptpage.js and secure.json files together
// DO NOT publish the rest
// Also, do not manually edit the json files or the code will break


const defaultnumberofiterations = 5000000; //PBKDF2 iterations; increase for better security or decrease for faster performance

const SECURE_FILE = "secure.json";
const PASSWORDS_FILE = "passwords_file_PRIVATE.json";

const crypto = require("crypto");
const fs = require("fs");
const readline = require("readline");

function deriveKey(password, salt, iterations = defaultnumberofiterations) {
  console.log("\nLoading...\n");
  return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
}

function deriveKeyFromPassword(password, secureData) {
  return deriveKey(
    password,
    Buffer.from(secureData.salt, "base64"),
    secureData.iterations
  );
}

function hashFilename(filename) {
  return crypto
    .createHash("sha256")
    .update(filename)
    .digest("base64");
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

function decryptAESGCM(key, encryptedData, outputEncoding = null) {
  const iv = Buffer.from(encryptedData.iv, "base64");
  const data = Buffer.from(encryptedData.ciphertext, "base64");
  const ciphertext = data.subarray(0, data.length - 16);
  const tag = data.subarray(data.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return outputEncoding
    ? decrypted.toString(outputEncoding)
    : decrypted;
}

function encryptKeyWithDerivedKey(mainKey, derivedKey) {
  return encryptAESGCM(derivedKey, mainKey);
}

function encryptPageWithMainKey(mainKey, html){
  return encryptAESGCM(mainKey, html, "utf8");
}

async function askQuestion(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()));
  });
}

async function exitWorkflow(rl, message = null, isError = true) {

  if (message) {
    if(isError){
      console.log(`\n\x1b[31mERROR:\x1b[0m ${message}`);
    }
    else{
      console.log(`\n\x1b[32mSUCCESS:\x1b[0m ${message}`);
    }
  }

  console.log("\nChoose an option:");
  console.log("1. Return to main menu");
  console.log("2. Exit");

  const answer = await askQuestion(rl, "> ");

  if (answer === "1") {
    console.log("");
    showMenu(rl);
    return;
  }

  rl.close();
}

function loadExistingSecureJson() {
  return JSON.parse(fs.readFileSync(SECURE_FILE, "utf8"));
}

function saveSecureJson(data) {

  fs.writeFileSync(
    SECURE_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function loadPasswordsFile() {

  if (!fs.existsSync(PASSWORDS_FILE)) {
    return [];
  }

  return JSON.parse(
    fs.readFileSync(PASSWORDS_FILE, "utf8")
  );
}

function createPasswordsFile(){
  fs.writeFileSync(
    PASSWORDS_FILE,
    JSON.stringify([], null, 2),
    "utf8"
  );
}

function savePasswordsFileIfExists(passwordData) {
  if(!fs.existsSync(PASSWORDS_FILE)) return; //safety check not to write to passwords file if not supposed to

  fs.writeFileSync(
    PASSWORDS_FILE,
    JSON.stringify(passwordData, null, 2),
    "utf8"
  );
}

async function passwordStorageQuestion(rl) {
  while (true) {
    console.log("\tDo you want to create a file that stores your passwords?");
    console.log("\t1. Yes, I want to create a file that stores my passwords");
    console.log("\t2. No, I will remember my passwords myself");
    const answer = await askQuestion(rl, "> ");

    if (answer === "1") {
      console.log(`\nI acknowledge that ${PASSWORDS_FILE} MUST BE KEPT PRIVATE and any leak is permanently irrevocable.`);      
      const acknowledge = await askQuestion(rl, "\tType 'I acknowledge' to continue: ");
      if (acknowledge === "I acknowledge") return true;
      console.log(`\n\x1b[31mAcknowledgement declined\x1b[0m`);
    }

    else if (answer === "2") {
      console.log("\nI acknowledge that if I forget my passwords, the encrypted files will not be recoverable without the original files.");
      const acknowledge = await askQuestion(rl, "\tType 'I acknowledge' to continue: ");
      if (acknowledge === "I acknowledge") return false;
      console.log(`\n\x1b[31mAcknowledgement declined\x1b[0m`);
    }
    else {
      console.log(`\n\x1b[31mInvalid option\x1b[0m`);
    }
  }
}

function encryptSinglePage(file, derivedKey, mainKey = crypto.randomBytes(32)){
  const html = fs.readFileSync(file, "utf8");
  const encryptedData = encryptPageWithMainKey(mainKey, html);
  const wrappedKeys = [
    encryptKeyWithDerivedKey(mainKey, derivedKey)
  ];

  return {
    filenameHash: hashFilename(file),
    pageData: encryptedData,
    wrappedKeys: wrappedKeys
  };
}

function findPageByKey(derivedKey, secureData) {
  for (let i = 0; i < secureData.data.length; i++) {
    const page = secureData.data[i];
    for (let j = 0; j < page.wrappedKeys.length; j++) {
      const wrappedKey = page.wrappedKeys[j];
      try {
        const mainKey = decryptAESGCM(
          derivedKey,
          wrappedKey
        );
        return {
          pageIndex: i,
          wrappedKeyIndex: j,
          mainKey: mainKey,
          wrappedKey: wrappedKey,
          page: page
        };
      } catch (err) {
        // incorrect password
      }
    }
  }
  return null;
}

function passwordAlreadyExists(derivedKey, secureData) {
  return findPageByKey(derivedKey, secureData) !== null;
}

async function addNewPageWorkflow(rl) {
  let secureData;
  let saltBuffer;
  let iterations;
  let passwordData = loadPasswordsFile();
  let shouldStorePasswords = fs.existsSync(PASSWORDS_FILE);
  const secureJsonExists = fs.existsSync(SECURE_FILE);

  if (!secureJsonExists) {
    const initialize = await askQuestion(rl, "Ready to create new encrypted file? (y/n): ");
    if (initialize.toLowerCase() !== "y") return exitWorkflow(rl, "Operation cancelled.");

    shouldStorePasswords = await passwordStorageQuestion(rl);
    if(shouldStorePasswords) {
      createPasswordsFile();
      passwordData = [];
    }
    
    const iterationInput = await askQuestion(rl,"Enter PBKDF2 iteration count (leave blank to use default value): ");

    if (iterationInput.trim() === "") {
      iterations = defaultnumberofiterations;
    } else {
      iterations = parseInt(iterationInput, 10);
      if (!Number.isInteger(iterations) || iterations <= 0) return exitWorkflow(rl, "Invalid iteration count.");
    }
    
    saltBuffer = crypto.randomBytes(16);

    secureData = {
      salt: saltBuffer.toString("base64"),
      iterations: iterations,
      data: []
    };

  } 
  else {
    secureData = loadExistingSecureJson();
    saltBuffer = Buffer.from(secureData.salt, "base64");
    iterations = secureData.iterations;
  }

  const filename = await askQuestion(rl, "Enter HTML filename: ");

  if (!filename.endsWith(".html")) return exitWorkflow(rl, "The file name must have a .html extension.");
  if (!fs.existsSync(filename)) return exitWorkflow(rl, "File does not exist.");

  const filenameHash = hashFilename(filename);
  const existingPage = secureData.data.find(
    p => p.filenameHash === filenameHash
  );

  if (existingPage) return exitWorkflow(rl, "A page with this filename is already encrypted. If the file has been changed and needs to be updated, select \"update a page\".");

  const password = await askQuestion(rl, "Create strong password for this page: ");

  const derivedKey = deriveKey(
    password,
    saltBuffer,
    iterations
  );

  if (passwordAlreadyExists(derivedKey, secureData)) return exitWorkflow(rl, "That password is already being used by another file.");

  const encryptedPage = encryptSinglePage(filename, derivedKey);

  secureData.data.push(encryptedPage);
  if (shouldStorePasswords){
    passwordData.push({
      file: filename,
      passwords: [password]
    });
  }

  saveSecureJson(secureData);
  savePasswordsFileIfExists(passwordData);

  return exitWorkflow(rl, "Page added successfully.", false);
}

async function removePageWorkflow(rl) {
  const shouldStorePasswords = fs.existsSync(PASSWORDS_FILE);

  if (!fs.existsSync(SECURE_FILE)) return exitWorkflow(rl, "secure.json does not exist.");

  const secureData = loadExistingSecureJson();
  const passwordData = loadPasswordsFile();

  const password = await askQuestion(
    rl,
    "Enter password for the page you want to remove: "
  );

  const derivedKey = deriveKeyFromPassword(password, secureData);

  const result = findPageByKey(derivedKey, secureData);
  if (!result) return exitWorkflow(rl, "No page found for that password.");
  const pageIndex = result.pageIndex;

  const confirmation = await askQuestion(
    rl,
    "Are you sure you want to permanently remove this page from the encrypted file? (y/n): "
  );

  if (confirmation.toLowerCase() !== "y") {
    return exitWorkflow(rl, "Operation cancelled.");
  }

  secureData.data.splice(pageIndex, 1);
  if (shouldStorePasswords) passwordData.splice(pageIndex, 1);

  saveSecureJson(secureData);
  savePasswordsFileIfExists(passwordData);

  return exitWorkflow(rl, "Page removed successfully.", false);
}

async function addPasswordWorkflow(rl) {
  const shouldStorePasswords = fs.existsSync(PASSWORDS_FILE);

  if (!fs.existsSync(SECURE_FILE)) return exitWorkflow(rl, "secure.json does not exist.");

  const secureData = loadExistingSecureJson();
  const passwordData = loadPasswordsFile();

  const oldPassword = await askQuestion(rl, "Enter existing password: ");

  const oldDerivedKey = deriveKeyFromPassword(oldPassword, secureData);

  const result = findPageByKey(oldDerivedKey, secureData);

  if (!result) return exitWorkflow(rl, "Password not found.");

  const pageIndex = result.pageIndex;
  const mainKey = result.mainKey;

  const newPassword = await askQuestion(rl, "Enter new password to add: ");

  const newDerivedKey = deriveKeyFromPassword(newPassword, secureData);

  if (passwordAlreadyExists(newDerivedKey, secureData)) {
    return exitWorkflow(rl, "That password is already being used.");
  }

  const newWrappedKey = encryptKeyWithDerivedKey(
    mainKey,
    newDerivedKey
  );

  secureData.data[pageIndex].wrappedKeys.push(newWrappedKey);
  if (shouldStorePasswords) passwordData[pageIndex].passwords.push(newPassword);

  saveSecureJson(secureData);
  savePasswordsFileIfExists(passwordData);

  return exitWorkflow(rl, "Password added successfully.", false);
}

async function removePasswordWorkflow(rl) {
  const shouldStorePasswords = fs.existsSync(PASSWORDS_FILE);

  if (!fs.existsSync(SECURE_FILE)) return exitWorkflow(rl, "secure.json does not exist.");

  const secureData = loadExistingSecureJson();
  const passwordData = loadPasswordsFile();

  const password = await askQuestion(rl, "Enter password to remove: ");

  const derivedKey = deriveKeyFromPassword(password, secureData);

  const result = findPageByKey(derivedKey, secureData);

  if (!result) return exitWorkflow(rl, "Password not found.");

  const pageIndex = result.pageIndex;
  const wrappedKeyIndex = result.wrappedKeyIndex;

  if (secureData.data[pageIndex].wrappedKeys.length <= 1)
    return exitWorkflow(rl, "Cannot remove the only remaining password for this page. Remove the page instead.");

  const confirmation = await askQuestion(rl, "Are you sure you want to remove this password? (y/n): ");

  if (confirmation.toLowerCase() !== "y") return exitWorkflow(rl, "Operation cancelled.");

  secureData.data[pageIndex].wrappedKeys.splice(wrappedKeyIndex, 1);

  let passwordIndex;
  if (shouldStorePasswords){
    passwordIndex = passwordData[pageIndex].passwords.indexOf(password);
    if (passwordIndex !== -1) passwordData[pageIndex].passwords.splice(passwordIndex, 1);
  }

  saveSecureJson(secureData);
  savePasswordsFileIfExists(passwordData);

  return exitWorkflow(rl, "Password removed successfully.", false);
}

async function changePasswordWorkflow(rl) {
  const shouldStorePasswords = fs.existsSync(PASSWORDS_FILE);

  if (!fs.existsSync(SECURE_FILE)) return exitWorkflow(rl, "secure.json does not exist.");

  const secureData = loadExistingSecureJson();
  const passwordData = loadPasswordsFile();

  const oldPassword = await askQuestion(
    rl,
    "Enter password to change: "
  );

  const oldDerivedKey = deriveKeyFromPassword(oldPassword, secureData);

  const result = findPageByKey(oldDerivedKey, secureData);

  if (!result) {
    return exitWorkflow(rl, "Password not found.");
  }

  const pageIndex = result.pageIndex;
  const wrappedKeyIndex = result.wrappedKeyIndex;
  const mainKey = result.mainKey;

  const newPassword = await askQuestion(
    rl,
    "Enter new password: "
  );

  const newDerivedKey = deriveKeyFromPassword(newPassword, secureData);

  if (passwordAlreadyExists(newDerivedKey, secureData)) {
    return exitWorkflow(rl, "That password is already being used.");
  }

  const newWrappedKey = encryptKeyWithDerivedKey(mainKey, newDerivedKey);

  secureData.data[pageIndex].wrappedKeys[wrappedKeyIndex] =
    newWrappedKey;

  let passwordIndex;
  if (shouldStorePasswords){
    passwordIndex = passwordData[pageIndex].passwords.indexOf(oldPassword);
    if (passwordIndex !== -1) {
      passwordData[pageIndex].passwords[passwordIndex] =
        newPassword;
    }
  } 

  saveSecureJson(secureData);
  savePasswordsFileIfExists(passwordData);
  return exitWorkflow(rl, "Password changed successfully.", false);
}

async function updatePageWorkflow(rl) {

  if (!fs.existsSync(SECURE_FILE))
    return exitWorkflow(rl, "secure.json does not exist.");

  const secureData = loadExistingSecureJson();

  const password = await askQuestion(rl, "Enter an existing password for the page: ");

  const derivedKey = deriveKeyFromPassword(password, secureData);

  const result = findPageByKey(derivedKey, secureData);

  if (!result)
    return exitWorkflow(rl, "Password not found.");

  const filename = await askQuestion(rl, "Enter updated HTML filename: ");

  if (!filename.endsWith(".html"))
    return exitWorkflow(rl, "The file name must have a .html extension.");

  if (!fs.existsSync(filename))
    return exitWorkflow(rl, "File does not exist.");

  const filenameHash = hashFilename(filename);

  if (filenameHash !== result.page.filenameHash)
    return exitWorkflow(rl, "That file does not match the encrypted page associated with this password.");

  const updatedEncryptedPage = encryptPageWithMainKey(result.mainKey, fs.readFileSync(filename, "utf8"))

  secureData.data[result.pageIndex].pageData = updatedEncryptedPage;

  saveSecureJson(secureData);

  return exitWorkflow(rl, "Page updated successfully.", false);
}

async function reEncryptPageWorkflow(rl) {
  console.log("Note: Re-encrypting a page is usually only done in case of a leaked password.");
  console.log("However, keep in mind that an attacker who has downloaded the file would still be able to read it.");

  const shouldStorePasswords = fs.existsSync(PASSWORDS_FILE);

  if (!fs.existsSync(SECURE_FILE))
    return exitWorkflow(rl, "secure.json does not exist.");

  const secureData = loadExistingSecureJson();
  const passwordData = loadPasswordsFile();

  const oldPassword = await askQuestion(rl, "Enter an existing password for the page to re-encrypt: ");

  const oldDerivedKey = deriveKeyFromPassword(oldPassword, secureData);

  const result = findPageByKey(oldDerivedKey, secureData);

  if (!result) return exitWorkflow(rl, "Password not found.");

  const confirmation = await askQuestion(rl, "WARNING: Re-encrypting this page will revoke ALL existing passwords for it. Continue? (y/n): ");

  if (confirmation.toLowerCase() !== "y")
    return exitWorkflow(rl, "Operation cancelled.");

  const newPassword = await askQuestion(rl, "Enter new password for the page: ");

  const newDerivedKey = deriveKeyFromPassword(newPassword, secureData);

  if (passwordAlreadyExists(newDerivedKey, secureData))
    return exitWorkflow(rl, "That password is already being used.");

  const decryptedHtml = decryptAESGCM(
    result.mainKey,
    result.page.pageData,
    "utf8"
  );

  const newMainKey = crypto.randomBytes(32);

  const updatedEncryptedPage = encryptPageWithMainKey(newMainKey, decryptedHtml);

  const newWrappedKey = encryptKeyWithDerivedKey(newMainKey, newDerivedKey);

  secureData.data[result.pageIndex].pageData = updatedEncryptedPage;

  secureData.data[result.pageIndex].wrappedKeys = [newWrappedKey];

  if (shouldStorePasswords)
    passwordData[result.pageIndex].passwords = [newPassword];

  saveSecureJson(secureData);
  savePasswordsFileIfExists(passwordData);

  return exitWorkflow(rl, "Page re-encrypted successfully.", false);
}

function showMenu(rl) {
  

  console.log("Choose an option:");
  console.log("1. Add a new page");
  console.log("2. Remove a page");
  console.log("3. Add a password");
  console.log("4. Remove a password");
  console.log("5. Change a password");
  console.log("6. Update a page");
  console.log("7. Re-encrypt an existing page");
  console.log("8. Exit");

  rl.question("> ", (answer) => {

    switch (answer.trim()) {
      case "1":
        addNewPageWorkflow(rl);
        return;

      case "2":
        removePageWorkflow(rl);
        return;

      case "3":
        addPasswordWorkflow(rl);
        return;

      case "4":
        removePasswordWorkflow(rl);
        return;

      case "5":
        changePasswordWorkflow(rl);
        return;
      
      case "6":
        updatePageWorkflow(rl);
        return;

      case "7":
        reEncryptPageWorkflow(rl);
        return;

      case "8":
        rl.close();
        return;

      default:
        console.log("Invalid option\n");
        showMenu(rl);
        return;
    }
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

if (!fs.existsSync(SECURE_FILE)) {
  console.log("Welcome to HTML Page Encrypter!\nTime for initial setup:\n");
  addNewPageWorkflow(rl);
}
else {
  showMenu(rl);
}