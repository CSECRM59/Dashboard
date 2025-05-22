// js/modules/synthese.js
import { getDb } from '../firebaseService.js';
import { applyRandomRotation } from '../utils.js';
import { COLLECTIONS } from '../config.js'; // Assure-toi que COLLECTIONS.INFOS_UTILES et EXPOSANTS sont définis ici

const db = getDb();
// Les instances de graphiques sont sur window, initialisées à null dans main.js
// window.mySynthChart = null;
// window.partnerCategoryChart = null;

export function loadSyntheseData() {
    console.log("Synthèse: Début loadSyntheseData (complet).");

    const rootStyles = getComputedStyle(document.documentElement);
    const getColor = (varName, fallback) => (rootStyles.getPropertyValue(varName)?.trim() || fallback);
    const defaultChartFontSize = parseFloat(getColor('font-size', '16px')) * 0.75 || 12;
    const encreTexteColor = getColor('--encre-texte', '#4a4a4a');

    const colors = {
        postitBleu: getColor('--postit-bleu', '#d3f1ff') + 'B3',
        postitRose: getColor('--postit-rose', '#ffe4e1') + 'B3',
        postitVert: getColor('--masking-tape-vert', '#cff0cc') + 'B3',
        postitPeche: getColor('--accent-couleur-2', '#ffb347') + 'B3',
        postitPrune: getColor('--postit-prune', '#dda0dd') + 'B3',
        postitOrange: getColor('--postit-orange', '#ffddb3') + 'B3',
        postitGris: getColor('--postit-gris', '#e0e0e0') + 'B3',
        postitViolet: getColor('--postit-violet', '#e6e0f8') + 'B3',
        postitTurquoise: getColor('--postit-turquoise', '#cceeee') + 'B3',
        postitOlive: getColor('--postit-olive', '#e9f5c9') + 'B3',
        postitVertClair: getColor('--postit-vert-clair', '#e0f2f1') + 'B3',
        postitBleuCiel: getColor('--postit-bleu-ciel', '#e1f5fe') + 'B3',
        postitExposantPlanning: getColor('--postit-exposant-planning', '#d1fae5') + 'B3',
        catColor1: 'rgba(255, 99, 132, 0.7)', catColor2: 'rgba(54, 162, 235, 0.7)',
        catColor3: 'rgba(255, 206, 86, 0.7)', catColor4: 'rgba(75, 192, 192, 0.7)',
        catColor5: 'rgba(153, 102, 255, 0.7)', catColor6: 'rgba(255, 159, 64, 0.7)'
    };
    const borders = {}; // Générer les bordures à partir des couleurs
    for (const key in colors) {
        if (colors[key].endsWith('B3')) { // Appliquer uniquement aux couleurs avec opacité
            borders[`border${key.charAt(0).toUpperCase() + key.slice(1).replace('postit', '')}`] = colors[key].slice(0, -2);
        } else { // Pour les couleurs déjà opaques (comme catColor)
             borders[`border${key.charAt(0).toUpperCase() + key.slice(1)}`] = colors[key].replace('0.7', '1');
        }
    }


    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(todayStart);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23,59,59,999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999);
    const ts = (date) => firebase.firestore.Timestamp.fromDate(date);

    Promise.all([
        db.collection(COLLECTIONS.NEWS).get(),
        db.collection(COLLECTIONS.MEMBERS).get(),
        db.collection(COLLECTIONS.PARTNERS).get(),
        db.collection(COLLECTIONS.EXPOSANTS).get(),
        db.collection(COLLECTIONS.CONTACT).where('status', '==', 'en cours').get(),
        db.collection(COLLECTIONS.SALARIES_TEST).get(),
        db.collection(COLLECTIONS.ANALYTICS).doc('globalCounts').get(),
        db.collection(COLLECTIONS.NEWS).where('createdAt', '>=', ts(startOfWeek)).get(),
        db.collection(COLLECTIONS.NEWS).where('createdAt', '>=', ts(startOfMonth)).get(),
        db.collection(COLLECTIONS.CONTACT).where('timestamp', '>=', ts(startOfWeek)).get(),
        db.collection(COLLECTIONS.CONTACT).where('timestamp', '>=', ts(startOfMonth)).get(),
        db.collection(COLLECTIONS.COFFEE).where('importTimestamp', '>=', ts(startOfWeek)).get(),
        db.collection(COLLECTIONS.COFFEE).where('importTimestamp', '>=', ts(startOfMonth)).get(),
        db.collection(COLLECTIONS.EXPOSANTS).where('createdAt', '>=', ts(startOfMonth)).get(),
        db.collection(COLLECTIONS.PARTNERS).where('createdAt', '>=', ts(startOfMonth)).get(),
        db.collection('planning_exposants').where('date_venue', '>=', ts(startOfWeek)).where('date_venue', '<=', ts(endOfWeek)).get(),
        db.collection('planning_exposants').where('date_venue', '>=', ts(startOfMonth)).where('date_venue', '<=', ts(endOfMonth)).get(),
    ]).then((snapshots) => {
        const [
            newsSnap, membersSnap, partnersSnap, exposantsSnap, contactsEnCoursSnap, salariesSnap, analyticsSnap,
            newsWeekSnap, newsMonthSnap, demandesWeekSnap, demandesMonthSnap, coffeeWeekSnap, coffeeMonthSnap,
            newExposantsMonthSnap, newPartnersMonthSnap, planningWeekSnap, planningMonthSnap
        ] = snapshots;

        let activeCoffeeCount = (window.coffeeData || []).filter(r => (r.status || 'en cours').toLowerCase().trim() === 'en cours').length;
        let totalBadgesCount = 0, totalCautionAmount = 0.0;
        if (salariesSnap && !salariesSnap.empty) {
            salariesSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.keys && Array.isArray(data.keys) && data.keys.length > 0) {
                    totalBadgesCount += data.keys.length;
                    data.keys.forEach(k => { if(k.type === 'R' && k.montant) totalCautionAmount += parseFloat(k.montant)||0; });
                } else if (data["Num de Clé"]) {
                    totalBadgesCount++;
                    if(data["E (echange) R (reglement)"] === 'R' && data["Montant réglé"]) totalCautionAmount += parseFloat(String(data["Montant réglé"]).replace(',','.'))||0;
                }
            });
        }
        totalCautionAmount = parseFloat(totalCautionAmount.toFixed(2));
        let totalViews = 0, totalInstalls = 0;
        if(analyticsSnap.exists) { const data = analyticsSnap.data(); totalViews=data.totalViews||0; totalInstalls=data.totalInstalls||0; }

        const exposantsPlannedThisWeek = new Set(); if(planningWeekSnap) planningWeekSnap.docs.forEach(d => exposantsPlannedThisWeek.add(d.data().exposantId));
        const exposantsPlannedThisMonth = new Set(); if(planningMonthSnap) planningMonthSnap.docs.forEach(d => exposantsPlannedThisMonth.add(d.data().exposantId));

        const counts = {
            news: newsSnap.size, members: membersSnap.size, partners: partnersSnap.size, exposants: exposantsSnap.size,
            contacts: contactsEnCoursSnap.size, coffee: activeCoffeeCount, totalBadges: totalBadgesCount,
            cautionAmount: totalCautionAmount, views: totalViews, installs: totalInstalls,
            newsLastWeek: newsWeekSnap.size, newsThisMonth: newsMonthSnap.size,
            demandesLastWeek: demandesWeekSnap.size, demandesThisMonth: demandesMonthSnap.size,
            coffeeLastWeek: coffeeWeekSnap.size, coffeeThisMonth: coffeeMonthSnap.size,
            newExposantsThisMonth: newExposantsMonthSnap.size, newPartnersThisMonth: newPartnersMonthSnap.size,
            exposantsSemaine: exposantsPlannedThisWeek.size, exposantsMois: exposantsPlannedThisMonth.size,
        };

        const synthCardsConfig = [
            { title: 'Actus', countKey: 'news', color: colors.postitBleu, borderColor: borders.borderBleu },
            { title: 'Membres', countKey: 'members', color: colors.postitRose, borderColor: borders.borderRose },
            { title: 'Partenaires', countKey: 'partners', color: colors.postitVert, borderColor: borders.borderVert },
            { title: 'Exposants', countKey: 'exposants', color: colors.postitOlive, borderColor: borders.borderOlive },
            { title: 'Contacts <small>(act.)</small>', countKey: 'contacts', color: colors.postitPeche, borderColor: borders.borderPeche },
            { title: 'Pannes Café <small>(act.)</small>', countKey: 'coffee', color: colors.postitPrune, borderColor: borders.borderPrune },
            { title: 'Badges Dist.', countKey: 'totalBadges', color: colors.postitOrange, borderColor: borders.borderOrange },
            { title: 'Total Cautions', countKey: 'cautionAmount', unit: '€', color: colors.postitGris, borderColor: borders.borderGris },
            { title: 'Vues App', countKey: 'views', color: colors.postitViolet, borderColor: borders.borderViolet },
            { title: 'Installs PWA', countKey: 'installs', color: colors.postitTurquoise, borderColor: borders.borderTurquoise },
            { title: 'Actus <small>(Sem.)</small>', countKey: 'newsLastWeek', color: colors.postitVertClair, borderColor: borders.borderVertClair },
            { title: 'Actus <small>(Mois)</small>', countKey: 'newsThisMonth', color: colors.postitVertClair, borderColor: borders.borderVertClair },
            { title: 'Demandes <small>(Sem.)</small>', countKey: 'demandesLastWeek', color: colors.postitBleuCiel, borderColor: borders.borderBleuCiel },
            { title: 'Demandes <small>(Mois)</small>', countKey: 'demandesThisMonth', color: colors.postitBleuCiel, borderColor: borders.borderBleuCiel },
            { title: 'Signal. Café <small>(Sem.)</small>', countKey: 'coffeeLastWeek', color: colors.postitOrange, borderColor: borders.borderOrange, unit:'<i class="fas fa-mug-hot fa-xs"></i>' },
            { title: 'Signal. Café <small>(Mois)</small>', countKey: 'coffeeThisMonth', color: colors.postitOrange, borderColor: borders.borderOrange, unit:'<i class="fas fa-mug-hot fa-xs"></i>' },
            { title: 'Nvx Parten.<small>(Mois)</small>', countKey: 'newPartnersThisMonth', color: colors.postitVert, borderColor: borders.borderVert },
            { title: 'Nvx Expos.<small>(Mois)</small>', countKey: 'newExposantsThisMonth', color: colors.postitOlive, borderColor: borders.borderOlive },
            { title: 'Expos Plann.<small>(Sem.)</small>', countKey: 'exposantsSemaine', color: colors.postitExposantPlanning, borderColor: borders.borderExposantPlanning, unit: '<i class="fas fa-store fa-xs"></i>' },
            { title: 'Expos Plann.<small>(Mois)</small>', countKey: 'exposantsMois', color: colors.postitExposantPlanning, borderColor: borders.borderExposantPlanning, unit: '<i class="fas fa-store fa-xs"></i>' },
        ];

        const synthContainer = document.getElementById('synthese-container');
        if (!synthContainer) { console.error("Synthèse: Conteneur '#synthese-container' INTROUVABLE."); return; }
        synthContainer.innerHTML = '';
        synthCardsConfig.forEach(cardData => {
            const countValue = counts[cardData.countKey];
            const displayValue = countValue !== undefined ? countValue : '?';
            const unit = cardData.unit || '';
            const item = document.createElement('div'); item.classList.add('synth-card');
            item.style.backgroundColor = cardData.color && cardData.color.endsWith('B3') ? cardData.color.slice(0, -2) : (cardData.color || '#e0e0e0');
            item.innerHTML = `<h3>${cardData.title}</h3><p>${displayValue}${unit}</p>`;
            synthContainer.appendChild(item);
        });
        if (window.uiCurrentActiveSectionId === 'section-synthese') applyRandomRotation('#section-synthese .synth-card');

        const mainItemsForChart = synthCardsConfig.filter(c =>!c.title.includes('<small>')); // Filtre plus simple
        updateMainSynthChart(mainItemsForChart, counts, encreTexteColor, defaultChartFontSize);

        const partnerCatCount = {};
        if(partnersSnap) partnersSnap.docs.forEach(d=>{const cat=d.data().Categorie||"Non Catégorisé";partnerCatCount[cat]=(partnerCatCount[cat]||0)+1;});
        updatePartnerCategoryChart(partnerCatCount, colors, defaultChartFontSize);

    }).catch(error => {
        console.error("Synthèse: Erreur critique Promesse.all:", error);
        // ... (gestion erreur et destruction graphiques)
        const synthContainer = document.getElementById('synthese-container');
        if (synthContainer) synthContainer.innerHTML = '<p class="error-message" style="color:red;">Erreur chargement synthèse.</p>';
        if (window.mySynthChart) { try { window.mySynthChart.destroy(); } catch(e){} window.mySynthChart = null; }
        if (window.partnerCategoryChart) { try { window.partnerCategoryChart.destroy(); } catch(e){} window.partnerCategoryChart = null; }
    });
}

function updateMainSynthChart(synthItems, counts, textColor, fontSize) {
    const ctx = document.getElementById('synth-chart')?.getContext('2d');
    if (!ctx) { console.warn("Synthèse: Canvas '#synth-chart' introuvable."); return; }
    const chartLabels = synthItems.map(d => d.title.replace(/<small>.*?<\/small>/gi,'').trim());
    const chartDataValues = synthItems.map(d => counts[d.countKey] !== undefined ? counts[d.countKey] : 0);
    const bgColors = synthItems.map(d => d.color || '#e0e0e0B3');
    const bdColors = synthItems.map(d => d.borderColor || '#c0c0c0');

    const data = { labels: chartLabels, datasets: [{ data: chartDataValues, backgroundColor: bgColors, borderColor: bdColors, borderWidth: 1.5 }] };
    const options = { responsive: true, maintainAspectRatio: true,
         plugins: {
             legend: { position: 'bottom', labels: { font: { family: "'Patrick Hand', cursive", size: fontSize }, color: textColor, padding: 10 }},
             tooltip: {
                 bodyFont: { family: "'Roboto', sans-serif", size: fontSize -1 }, titleFont: { family: "'Patrick Hand', cursive", size: fontSize },
                 backgroundColor: 'rgba(74,74,74,0.85)', titleColor:'#fff', bodyColor:'#fff', padding:10, cornerRadius:3,
                 callbacks: { label: (c)=>{ const item = synthItems[c.dataIndex]; return `${c.label}: ${c.parsed||0} ${item.unit||''}`;}}
             }
         }
    };
    if (window.mySynthChart) { window.mySynthChart.data = data; window.mySynthChart.options = options; window.mySynthChart.update(); }
    else { window.mySynthChart = new Chart(ctx, { type: 'doughnut', data, options }); }
}

function updatePartnerCategoryChart(categoriesData, colorPalette, fontSize) {
    const ctx = document.getElementById('partner-category-chart')?.getContext('2d');
    if (!ctx) { console.warn("Synthèse: Canvas '#partner-category-chart' introuvable."); return; }
    const labels = Object.keys(categoriesData);
    const dataValues = Object.values(categoriesData);
    const bgColors = [colorPalette.catColor1,colorPalette.catColor2,colorPalette.catColor3,colorPalette.catColor4,colorPalette.catColor5,colorPalette.catColor6].slice(0,labels.length);
    const bdColors = bgColors.map(c => c.replace('0.7','1'));

    const data = { labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderColor: bdColors, borderWidth: 1 }] };
    const options = { responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: {font:{size:fontSize-2}}},
            title: { display: true, text: 'Partenaires par Catégorie', font: { size: fontSize+2, family: "'Patrick Hand', cursive", color: encreTexteColor }}
        }
    };
    if (window.partnerCategoryChart) { window.partnerCategoryChart.data = data; window.partnerCategoryChart.options = options; window.partnerCategoryChart.update(); }
    else { window.partnerCategoryChart = new Chart(ctx, { type: 'pie', data, options }); }
}