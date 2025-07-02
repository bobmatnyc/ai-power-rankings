#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

// Define comprehensive translations for all missing keys
const translations: Record<string, Record<string, string>> = {
  de: {
    // Home recent section
    "home.recent.title": "Neueste Updates",
    "home.recent.description": "Aktuelle Entwicklungen und Feature-Releases von Top-KI-Tools",
    "home.recent.viewAllButton": "Alle Neuigkeiten anzeigen",
    
    // Footer
    "footer.description": "Die autoritäre Quelle für KI-Coding-Tool-Rankings und -Analysen",
    "footer.quickLinks": "Schnelllinks",
    "footer.categories": "Kategorien",
    "footer.copyright": "© 2025 AI Power Rankings. Alle Rechte vorbehalten.",
    
    // Algorithm factors
    "rankings.algorithm.factors.agentic": "Agentic-Fähigkeit",
    "rankings.algorithm.factors.innovation": "Innovation",
    "rankings.algorithm.factors.performance": "Leistung",
    "rankings.algorithm.factors.adoption": "Akzeptanz",
    "rankings.algorithm.factors.traction": "Marktzugkraft",
    "rankings.algorithm.factors.sentiment": "Geschäftsstimmung",
    "rankings.algorithm.factors.velocity": "Entwicklungsgeschwindigkeit",
    "rankings.algorithm.factors.resilience": "Plattform-Resilienz",
    
    // Algorithm modifiers
    "rankings.algorithm.modifiers.decay": "Innovationsverfall",
    "rankings.algorithm.modifiers.risk": "Plattformrisiko",
    "rankings.algorithm.modifiers.revenue": "Umsatzqualität",
    
    // Algorithm links
    "rankings.algorithm.methodologyText": "Basierend auf unserer transparenten",
    "rankings.algorithm.viewMethodology": "Methodik anzeigen",
    
    // Tools
    "tools.notFound": "Tool nicht gefunden",
    "tools.backToTools": "Zurück zu Tools",
    "tools.detail.tabs.pricing": "Preise",
    
    // Newsletter verification
    "newsletter.verify.goToHomepage": "Zur Startseite",
    "newsletter.verify.tryAgain": "Erneut versuchen",
    "newsletter.verify.success.title": "E-Mail erfolgreich verifiziert!",
    "newsletter.verify.success.description": "Vielen Dank für die Bestätigung Ihrer E-Mail-Adresse. Sie erhalten nun unseren monatlichen Newsletter.",
    "newsletter.verify.alreadyVerified.title": "E-Mail bereits verifiziert",
    "newsletter.verify.alreadyVerified.description": "Diese E-Mail-Adresse wurde bereits verifiziert.",
    "newsletter.verify.error.title": "Verifizierungsfehler",
    "newsletter.verify.errors.default": "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.",
    "newsletter.verify.errors.missingToken": "Verifizierungstoken fehlt",
    "newsletter.verify.errors.invalidToken": "Ungültiger oder abgelaufener Verifizierungstoken",
    "newsletter.verify.errors.verificationFailed": "E-Mail-Verifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.",
    
    // Newsletter unsubscribe
    "newsletter.unsubscribe.success.description": "Sie wurden vom AI Power Ranking Newsletter abgemeldet. Es tut uns leid, Sie gehen zu sehen!",
    "newsletter.unsubscribe.error.title": "Abmeldefehler",
    "newsletter.unsubscribe.errors.unsubscribeFailed": "Wir konnten Ihre Abmeldeanfrage nicht verarbeiten. Bitte versuchen Sie es später erneut.",
    "newsletter.unsubscribe.errors.default": "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut."
  },
  
  fr: {
    // Home recent section
    "home.recent.title": "Mises à jour récentes",
    "home.recent.description": "Derniers développements et sorties de fonctionnalités des meilleurs outils IA",
    "home.recent.viewAllButton": "Voir toutes les actualités",
    
    // Footer
    "footer.description": "La source faisant autorité pour les classements et analyses d'outils de codage IA",
    "footer.quickLinks": "Liens rapides",
    "footer.categories": "Catégories",
    "footer.copyright": "© 2025 AI Power Rankings. Tous droits réservés.",
    
    // Algorithm factors
    "rankings.algorithm.factors.agentic": "Capacité agentique",
    "rankings.algorithm.factors.innovation": "Innovation",
    "rankings.algorithm.factors.performance": "Performance",
    "rankings.algorithm.factors.adoption": "Adoption",
    "rankings.algorithm.factors.traction": "Traction du marché",
    "rankings.algorithm.factors.sentiment": "Sentiment commercial",
    "rankings.algorithm.factors.velocity": "Vélocité de développement",
    "rankings.algorithm.factors.resilience": "Résilience de la plateforme",
    
    // Algorithm modifiers
    "rankings.algorithm.modifiers.decay": "Déclin de l'innovation",
    "rankings.algorithm.modifiers.risk": "Risque de plateforme",
    "rankings.algorithm.modifiers.revenue": "Qualité des revenus",
    
    // Algorithm links
    "rankings.algorithm.methodologyText": "Basé sur notre transparente",
    "rankings.algorithm.viewMethodology": "Voir la méthodologie",
    
    // Tools
    "tools.notFound": "Outil non trouvé",
    "tools.backToTools": "Retour aux outils",
    "tools.detail.tabs.pricing": "Tarifs",
    
    // Newsletter verification
    "newsletter.verify.goToHomepage": "Aller à la page d'accueil",
    "newsletter.verify.tryAgain": "Réessayer",
    "newsletter.verify.success.title": "Email vérifié avec succès !",
    "newsletter.verify.success.description": "Merci d'avoir confirmé votre adresse email. Vous recevrez maintenant notre newsletter mensuelle.",
    "newsletter.verify.alreadyVerified.title": "Email déjà vérifié",
    "newsletter.verify.alreadyVerified.description": "Cette adresse email a déjà été vérifiée.",
    "newsletter.verify.error.title": "Erreur de vérification",
    "newsletter.verify.errors.default": "Une erreur inattendue s'est produite. Veuillez réessayer plus tard.",
    "newsletter.verify.errors.missingToken": "Jeton de vérification manquant",
    "newsletter.verify.errors.invalidToken": "Jeton de vérification invalide ou expiré",
    "newsletter.verify.errors.verificationFailed": "La vérification de l'email a échoué. Veuillez réessayer.",
    
    // Newsletter unsubscribe
    "newsletter.unsubscribe.success.description": "Vous avez été désinscrit de la newsletter AI Power Ranking. Nous sommes désolés de vous voir partir !",
    "newsletter.unsubscribe.error.title": "Erreur de désinscription",
    "newsletter.unsubscribe.errors.unsubscribeFailed": "Nous n'avons pas pu traiter votre demande de désinscription. Veuillez réessayer plus tard.",
    "newsletter.unsubscribe.errors.default": "Une erreur inattendue s'est produite. Veuillez réessayer plus tard."
  },
  
  it: {
    // Algorithm factors
    "rankings.algorithm.factors.agentic": "Capacità agentiche",
    "rankings.algorithm.factors.innovation": "Innovazione",
    "rankings.algorithm.factors.performance": "Prestazioni",
    "rankings.algorithm.factors.adoption": "Adozione",
    "rankings.algorithm.factors.traction": "Trazione di mercato",
    "rankings.algorithm.factors.sentiment": "Sentiment aziendale",
    "rankings.algorithm.factors.velocity": "Velocità di sviluppo",
    "rankings.algorithm.factors.resilience": "Resilienza della piattaforma",
    
    // Algorithm modifiers
    "rankings.algorithm.modifiers.decay": "Decadimento dell'innovazione",
    "rankings.algorithm.modifiers.risk": "Rischio della piattaforma",
    "rankings.algorithm.modifiers.revenue": "Qualità dei ricavi",
    
    // Algorithm links
    "rankings.algorithm.methodologyText": "Basato sulla nostra trasparente",
    "rankings.algorithm.viewMethodology": "Visualizza metodologia",
    
    // Tools
    "tools.notFound": "Strumento non trovato",
    "tools.backToTools": "Torna agli strumenti",
    "tools.detail.tabs.pricing": "Prezzi"
  },
  
  hr: {
    // Algorithm factors
    "rankings.algorithm.factors.agentic": "Agentna sposobnost",
    "rankings.algorithm.factors.innovation": "Inovacija",
    "rankings.algorithm.factors.performance": "Performanse",
    "rankings.algorithm.factors.adoption": "Prihvaćanje",
    "rankings.algorithm.factors.traction": "Tržišna privlačnost",
    "rankings.algorithm.factors.sentiment": "Poslovni sentiment",
    "rankings.algorithm.factors.velocity": "Brzina razvoja",
    "rankings.algorithm.factors.resilience": "Otpornost platforme",
    
    // Algorithm modifiers
    "rankings.algorithm.modifiers.decay": "Opadanje inovacije",
    "rankings.algorithm.modifiers.risk": "Rizik platforme",
    "rankings.algorithm.modifiers.revenue": "Kvaliteta prihoda",
    
    // Algorithm links
    "rankings.algorithm.methodologyText": "Temeljeno na našoj transparentnoj",
    "rankings.algorithm.viewMethodology": "Pogledaj metodologiju",
    
    // Tools
    "tools.notFound": "Alat nije pronađen",
    "tools.backToTools": "Natrag na alate",
    "tools.detail.tabs.pricing": "Cijene"
  },
  
  uk: {
    // Algorithm factors
    "rankings.algorithm.factors.agentic": "Агентна здатність",
    "rankings.algorithm.factors.innovation": "Інновації",
    "rankings.algorithm.factors.performance": "Продуктивність",
    "rankings.algorithm.factors.adoption": "Прийняття",
    "rankings.algorithm.factors.traction": "Ринкова тяга",
    "rankings.algorithm.factors.sentiment": "Бізнес-настрої",
    "rankings.algorithm.factors.velocity": "Швидкість розробки",
    "rankings.algorithm.factors.resilience": "Стійкість платформи",
    
    // Algorithm modifiers
    "rankings.algorithm.modifiers.decay": "Спад інновацій",
    "rankings.algorithm.modifiers.risk": "Ризик платформи",
    "rankings.algorithm.modifiers.revenue": "Якість доходу",
    
    // Algorithm links
    "rankings.algorithm.methodologyText": "На основі нашої прозорої",
    "rankings.algorithm.viewMethodology": "Переглянути методологію",
    
    // Tools
    "tools.notFound": "Інструмент не знайдено",
    "tools.backToTools": "Назад до інструментів",
    "tools.detail.tabs.pricing": "Ціни"
  },
  
  ko: {
    // Tools
    "tools.detail.tabs.pricing": "가격",
    "tools.notFound": "도구를 찾을 수 없습니다",
    "tools.backToTools": "도구 목록으로 돌아가기",
    
    // Newsletter unsubscribe
    "newsletter.unsubscribe.success.description": "AI Power Ranking 뉴스레터 구독이 취소되었습니다. 떠나시게 되어 아쉽습니다!",
    "newsletter.unsubscribe.errors.unsubscribeFailed": "구독 취소 요청을 처리할 수 없습니다. 나중에 다시 시도해주세요.",
    "newsletter.unsubscribe.errors.default": "예기치 않은 오류가 발생했습니다. 나중에 다시 시도해주세요.",
    "newsletter.unsubscribe.error.title": "구독 취소 오류"
  }
};

// Function to update translations
function updateTranslations(langCode: string, langDict: any, translations: Record<string, string>) {
  let updateCount = 0;
  
  for (const [key, translation] of Object.entries(translations)) {
    const keyParts = key.split('.');
    let current = langDict;
    
    // Navigate to the parent object
    for (let i = 0; i < keyParts.length - 1; i++) {
      if (!current[keyParts[i]]) {
        current[keyParts[i]] = {};
      }
      current = current[keyParts[i]];
    }
    
    const lastKey = keyParts[keyParts.length - 1];
    if (current[lastKey] && current[lastKey].startsWith('[TRANSLATE]')) {
      current[lastKey] = translation;
      updateCount++;
    }
  }
  
  return { dict: langDict, updateCount };
}

// Process each language
for (const [lang, langTranslations] of Object.entries(translations)) {
  console.log(`\nProcessing ${lang}...`);
  const langPath = path.join(process.cwd(), `src/i18n/dictionaries/${lang}.json`);
  const langDict = JSON.parse(fs.readFileSync(langPath, 'utf-8'));
  
  const { dict: updatedDict, updateCount } = updateTranslations(lang, langDict, langTranslations);
  
  if (updateCount > 0) {
    fs.writeFileSync(langPath, JSON.stringify(updatedDict, null, 2) + '\n');
    console.log(`  Updated ${updateCount} translations`);
  } else {
    console.log(`  No translations updated`);
  }
}

console.log('\nTranslation update complete!');
console.log('Note: This script only translates the most important keys.');
console.log('Additional keys may still need translation.');