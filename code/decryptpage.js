let encryptedDataPromise = null; //so that the file only calls GET API once
let isUnlocking = false; //this is to prevent multiple concurrent calls

function loadEncrypted() {
  if (!encryptedDataPromise) {
    encryptedDataPromise = fetch("secure.json").then(res => res.json());
  }
  return encryptedDataPromise;
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(password, salt, iterations) {
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
      iterations: iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decrypt(data, key) {
  try {
    const iv = base64ToArrayBuffer(data.iv);
    const ciphertext = base64ToArrayBuffer(data.ciphertext);

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

function activateScripts(container) {
  const scripts = container.querySelectorAll("script");

  scripts.forEach(oldScript => {
    const newScript = document.createElement("script");

    // copy attributes (e.g., src, type)
    for (const attr of oldScript.attributes) {
      newScript.setAttribute(attr.name, attr.value);
    }

    // copy inline script content
    newScript.textContent = oldScript.textContent;

    // replace old script with new one (this triggers execution)
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

async function unlock() {
  if (isUnlocking) return; // ignore extra calls

  isUnlocking = true;

  try {
    document.getElementById("msg").innerText = "Checking code...";
    const password = document.getElementById("password").value;
    const filedata = await loadEncrypted();

    const data = filedata.data;
    const salt = base64ToArrayBuffer(filedata.salt);
    const iterations = filedata.iterations;
    const key = await deriveKey(password, salt, iterations);

    let success = null;
    for (const entry of data) {
      const result = await decrypt(entry, key);
      if (result) {
        success = result;
        break;
      }
    }

    if (!success) {
      document.getElementById("msg").innerText = "Invalid code";
      return;
    } else {
      document.getElementById("msg").innerText = "Code was found but could not render. This means there is an error.";
    }

    // render returned HTML
    const contentEl = document.getElementById("content");
    contentEl.innerHTML = success;

    // activate any scripts inside it
    activateScripts(contentEl);

  } finally {
    isUnlocking = false; // always release lock
  }
}