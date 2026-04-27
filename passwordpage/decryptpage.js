async function loadEncrypted() {
  const res = await fetch("secure.json");
  return await res.json();
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

async function decrypt(data, password) {
  try {
    const iv = base64ToArrayBuffer(data.iv);
    const salt = base64ToArrayBuffer(data.salt);
    const ciphertext = base64ToArrayBuffer(data.ciphertext);

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

async function unlock() {
  document.getElementById("msg").innerText = "Checking...";
  const password = document.getElementById("password").value;
  const data = await loadEncrypted();

  let success = null;
  for (const entry of data) {
    const result = await decrypt(entry, password);
    if (result) {
      success = result;
      break;
    }
  }

  if (!success) {
    document.getElementById("msg").innerText = "Wrong password";
    return;
  }


  // Render decrypted HTML
  document.getElementById("content").innerHTML = success;
}