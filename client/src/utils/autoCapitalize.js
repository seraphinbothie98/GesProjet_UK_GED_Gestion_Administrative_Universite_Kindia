/**
 * Module d'auto-majuscule global pour UK-GED
 * Transforme automatiquement la première lettre de chaque phrase / champ de saisie en majuscule.
 * S'applique à tous les champs de texte et zones de texte (input, textarea)
 * sauf pour les mots de passe, emails, URLs, codes/tokens, nombres, etc.
 */

export function initGlobalAutoCapitalize() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const shouldIgnore = (el) => {
    if (!el) return true;
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';
    if (tagName !== 'input' && tagName !== 'textarea') return true;

    if (el.dataset && el.dataset.noAutocapitalize === 'true') return true;

    const type = (el.type || 'text').toLowerCase();
    const ignoredTypes = [
      'password', 'email', 'url', 'number', 'tel', 'date', 'time',
      'datetime-local', 'file', 'checkbox', 'radio', 'hidden', 'range', 'color'
    ];
    if (ignoredTypes.includes(type)) return true;

    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.placeholder || '').toLowerCase();

    if (
      name.includes('email') || name.includes('password') || name.includes('token') ||
      id.includes('email') || id.includes('password') || id.includes('token') ||
      placeholder.includes('email') || placeholder.includes('mot de passe')
    ) {
      return true;
    }

    return false;
  };

  const capitalizeSentences = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/(^|[.!?\n]\s*)([a-zà-öø-ÿ])/g, (match, prefix, char) => {
      return prefix + char.toUpperCase();
    });
  };

  // 1. Activer l'attribut natif pour claviers virtuels / mobiles
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!shouldIgnore(el)) {
      if (!el.getAttribute('autocapitalize')) {
        el.setAttribute('autocapitalize', 'sentences');
      }
    }
  }, true);

  // 2. Gestion de la frappe en temps réel (Capture Phase pour devancer React)
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (shouldIgnore(el)) return;

    const val = el.value;
    if (!val || typeof val !== 'string') return;

    const capitalized = capitalizeSentences(val);

    if (capitalized !== val) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = capitalized;

      // Conserver la position du curseur
      if (start !== null && end !== null && typeof el.setSelectionRange === 'function') {
        try {
          el.setSelectionRange(start, end);
        } catch (err) {}
      }
    }
  }, true);

  // 3. Formater également lors de la perte de focus (blur) pour sécuriser le collage de texte
  document.addEventListener('focusout', (e) => {
    const el = e.target;
    if (shouldIgnore(el)) return;

    const val = el.value;
    if (!val || typeof val !== 'string') return;

    const capitalized = capitalizeSentences(val);
    if (capitalized !== val) {
      el.value = capitalized;
      // Déclencher un événement change pour avertir React / formulaires
      try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (err) {}
    }
  }, true);
}
