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
  // Encoded array and key (both safe to expose here)
  var _enc = [120,66,56,100,93,119,121,71,60,35,78,61,100,67,25,106,66,56,100,67,119,110,64,52];
  var _key = [13, 47, 89];

  // decode into string
  function _decode(enc, key) {
    var out = new Array(enc.length);
    for (var i = 0; i < enc.length; i++) {
      out[i] = String.fromCharCode(enc[i] ^ key[i % key.length]);
    }
    return out.join('');
  }

  // Safe writing to DOM: create text node (not innerHTML)
  function _placeEmail(target) {
    if (!target) return false;
    // Avoid duplicating if already filled
    if (target.dataset.filled === '1') return true;

    var email = _decode(_enc, _key);

    // Insert as text node 
    var tn = document.createTextNode(email);
    // Clear existing children, then append text node
    while (target.firstChild) target.removeChild(target.firstChild);
    target.appendChild(tn);
    // mark as filled
    target.dataset.filled = '1';

    return true;
  }

  // Try to find intended targets:
  function _findAndPlace() {
    // Primary: element with id="email-container"
    var primary = document.getElementById('email-container');
    if (primary) 
        setTimeout(function() {
            _placeEmail(primary);
        }, 300);

    // Secondary: any elements with class "email-obf"
    var els = document.getElementsByClassName('email-obf');
    for (var i = 0; i < els.length; i++) {
    setTimeout(function() {
      _placeEmail(el);
    }, 300);
    }
  }

  // Defer placement until DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _findAndPlace, false);
  } else {
    _findAndPlace();
  }

  // (Optional) expose a safe function if you need to programmatically insert:
  window.__insertObfEmail = _placeEmail;
})();










document.getElementById('copy-email-btn').addEventListener('click', function() {
    var emailEl = document.getElementById('email-container');
    if (!emailEl) return;

    // Copy text to clipboard
    navigator.clipboard.writeText(emailEl.textContent).then(function() {
        var btn = document.getElementById('copy-email-btn');
    var originalText = btn.textContent;
    btn.textContent = 'Copied!';

    // Revert back after 2 seconds
    setTimeout(function() {
        btn.textContent = originalText;
    }, 2000);
    }, function(err) {
        console.error('Failed to copy email: ', err);
        var btn = document.getElementById('copy-email-btn');
        var originalText = btn.textContent;
        btn.textContent = 'Sorry, failed to copy to clipboard';

    // Revert back after 2 seconds
    setTimeout(function() {
        btn.textContent = originalText;
    }, 2000);
    });
});
