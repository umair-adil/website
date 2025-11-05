// for obfuscation against scrapers
// Decodes an obfuscated email and writes it into elements with id="email-container"
// or class="email-obf"

/* 
  How it works:
  - The email characters were XOR'd against a 3-byte repeating key and stored as numbers.
  - At runtime we XOR again to restore original char codes and join into the address.
  - The code writes plain text into a target element so it is readable by people but not present
    in the HTML source as plain text.
*/

(function () {
  var _enc = [120,66,56,100,93,119,121,71,60,35,78,61,100,67,25,106,66,56,100,67,119,110,64,52];
  var _key = [13, 47, 89];

  function _decode(enc, key) {
    var out = new Array(enc.length);
    for (var i = 0; i < enc.length; i++) {
      out[i] = String.fromCharCode(enc[i] ^ key[i % key.length]);
    }
    return out.join('');
  }

  function _placeEmail(target) {
    if (!target) return false;
    if (target.dataset.filled === '1') return true;

    var email = _decode(_enc, _key);
    var tn = document.createTextNode(email);

    while (target.firstChild) target.removeChild(target.firstChild);
    target.appendChild(tn);
    target.dataset.filled = '1';

    return true;
  }

  // Expose function globally so button click can trigger it
  window.__insertObfEmail = _placeEmail;

  // On DOM ready
  function _init() {
    var btn = document.getElementById('copy-email-btn');
    var emailContainer = document.getElementById('email-container');
    if (!btn || !emailContainer) return;

    // Start with "Reveal" text
    btn.textContent = 'Reveal';

    // First click reveals email, then changes button to copy behavior
    btn.addEventListener('click', function revealHandler() {
      if (!emailContainer.dataset.filled) {
        _placeEmail(emailContainer);
        btn.textContent = 'Copy';

        // Replace this listener with copy functionality
        btn.removeEventListener('click', revealHandler);
        btn.addEventListener('click', function copyHandler() {
          navigator.clipboard.writeText(emailContainer.textContent).then(function () {
            var originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(function () {
              btn.textContent = originalText;
            }, 2000);
          }, function (err) {
            console.error('Failed to copy email: ', err);
            var originalText = btn.textContent;
            btn.textContent = 'Sorry, failed to copy';
            setTimeout(function () {
              btn.textContent = originalText;
            }, 2000);
          });
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init, false);
  } else {
    _init();
  }
})();
