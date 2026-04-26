let data = [];
let currentIndex = 0;

async function loadData() {
  const res = await fetch("data.json");
  data = await res.json();

  showQuestion(data[0].plaintext);
}

function showQuestion(q) {
  document.getElementById("question").innerText = q;
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decrypt(dataObj, password) {
  try {
    const iv = base64ToArrayBuffer(dataObj.iv);
    const salt = base64ToArrayBuffer(dataObj.salt);
    const ciphertext = base64ToArrayBuffer(dataObj.ciphertext);

    const key = await deriveKey(password, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

async function submitAnswer() {
  const input = document.getElementById("answer").value;
  const next = data[currentIndex + 1];

  if (!next) {
    document.getElementById("message").innerText = "Finished!";
    return;
  }

  const result = await decrypt(next, input);

  if (result) {
    currentIndex++;
    showQuestion(result);
    //hide the answer text box
    if (currentIndex === data.length - 1) {
        document.getElementById("answer").style.display = "none";
        document.getElementById("submitAnswerButton").style.display = "none";
    }
    document.getElementById("message").innerText = "";
    document.getElementById("answer").value = "";
  } else {
    document.getElementById("message").innerText = "Wrong answer!";
  }
}

loadData();