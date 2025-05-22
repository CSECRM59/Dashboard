// js/modules/signalementsCafe.js
import { getDb, updateDocumentStatus as fbUpdateStatus } from '../firebaseService.js';
import { showNotification } from '../utils.js';
import { COLLECTIONS } from '../config.js';

const db = getDb();

// Les instances sont mises sur `window` pour être accessibles par ui.js (destruction lors de la navigation)
// et pour que les fonctions de ce module puissent les manipuler.
// Elles sont initialisées à null dans main.js et vérifiées ici avant utilisation.
// window.coffeeData est aussi initialisé dans main.js

// --- CHARGEMENT ET GESTION DES DONNÉES ---
export function loadCoffeeReports() {
    db.collection(COLLECTIONS.COFFEE).orderBy('importTimestamp', 'desc').onSnapshot(snapshot => {
        console.log("SIGNALEMENTS CAFE: Firestore onSnapshot - Reçu", snapshot.docs.length, "documents.");
        if (typeof window.coffeeData === 'undefined') window.coffeeData = []; // Sécurité
        
        window.coffeeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const rechargeReports = window.coffeeData.filter(report => {
            const status = (report.status || 'en cours').toLowerCase().trim();
            const probleme = (report.probleme || '').toLowerCase();
            return (status === 'en cours' || status === '') && (probleme.includes('rechargement') || probleme.includes('paiement') || probleme.includes('badge'));
        });

        // Mettre à jour seulement si la section est active, sinon les données sont prêtes pour la prochaine activation
        if (window.uiCurrentActiveSectionId === 'section-coffee') {
            console.log("SIGNALEMENTS CAFE: Section active, mise à jour des tables et graphiques.");
            if (!window.coffeeTable) initializeCoffeeTable();
            else window.coffeeTable.setData([...window.coffeeData]).catch(err => console.error("Erreur setData coffeeTable:", err));

            if (!window.rechargeTable) initializeRechargeTable(rechargeReports);
            else window.rechargeTable.setData([...rechargeReports]).catch(err => console.error("Erreur setData rechargeTable:", err));
            
            updateCoffeeStatsAndCharts(window.coffeeData);
        } else {
            console.log("SIGNALEMENTS CAFE: Section non active, données mises à jour en arrière-plan.");
        }

    }, error => {
        console.error("Erreur Firestore (Coffee):", error);
        showNotification("Erreur chargement signalements café.", true);
        if (window.uiCurrentActiveSectionId === 'section-coffee') updateCoffeeStatsAndCharts([]); // Vider en cas d'erreur
        if (window.coffeeTable) window.coffeeTable.setData([]).catch(e => console.error(e));
        if (window.rechargeTable) window.rechargeTable.setData([]).catch(e => console.error(e));
    });
}

// --- INITIALISATION DES TABLES TABULATOR ---
export function initializeCoffeeTable() {
    const container = document.getElementById('coffee-table-container');
    if (!container) { console.error("Conteneur #coffee-table-container introuvable !"); return; }
    if (window.coffeeTable) { console.log("SIGNALEMENTS CAFE: coffeeTable existe déjà."); return; }

    console.log("SIGNALEMENTS CAFE: Initialisation coffeeTable...");
    const columns = [
        { title: "Date Signal.", field: "importTimestamp", width:150, hozAlign:"left", sorter:"datetime", sorterParams:{format:"iso"}, formatter:(c)=>{ const t=c.getValue(); return t?.toDate?t.toDate().toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):(t?new Date(t).toLocaleString('fr-FR'):"?");}},
        { title: "Téléphone", field: "telephone", width:120, headerFilter:"input", formatter:(c)=>c.getValue()||"N/A"},
        { title: "Machine", field: "machine", width:140, headerFilter:"input"},
        { title: "Problème", field: "probleme", minWidth:180, headerTooltip:true, formatter:"textarea", headerFilter:"input"},
        { title: "Par", field: "nom", width:130, headerFilter:"input"},
        { title: "Email", field: "email", width:160, formatter:"link", formatterParams:{urlPrefix:"mailto:"}, headerTooltip:true, headerFilter:"input"},
        { title: "Opération", field: "operation", width:100, headerFilter:"input"},
        { title: "Date Évén.", field: "dateEvenementRaw", width:90, hozAlign:"center", sorter:"date", sorterParams:{format:"YYYY-MM-DD"}, formatter:(c)=>c.getValue()||"-"},
        { title: "Heure Évén.", field: "heureEvenementRaw", width:80, hozAlign:"center", sorter:"time", sorterParams:{format:"HH:mm"}, formatter:(c)=>c.getValue()||"-"},
        { title: "Paiement", field: "paiement", width:90, headerFilter:"input", formatter:(c)=>c.getValue()||"N/A"},
        { title: "Commentaire", field: "commentaire", minWidth:150, formatter:"textarea", headerTooltip:true, headerFilter:"input"},
        { title: "Statut", field: "status", width:110, hozAlign:"center", headerFilter:"select", headerFilterParams:{values:{"":"Tous","en cours":"En cours","traité":"Traité"}}, editor:"select", editorParams:{values:{"en cours":"En cours","traité":"Traité"}}, formatter:(c)=>{ const v=c.getValue()||"en cours",iT=v==='traité'; return `<span style="color:${iT?'var(--accent-couleur-1)':'var(--accent-couleur-2)'};font-weight:bold;"><i class="fas ${iT?'fa-check-circle':'fa-exclamation-circle'}" style="margin-right:5px;"></i>${iT?'Traité':'En cours'}</span>`;}, cellEdited:(c)=>updateCoffeeReportStatus(c.getRow().getData().id,c.getValue())},
        { title:"Action", hozAlign:"center", width:70, headerSort:false, formatter:(c)=>{ const id=c.getRow().getData().id; const btn=document.createElement("button");btn.className="btn-action delete";btn.innerHTML='<i class="fas fa-trash"></i>';btn.title="Supprimer";btn.onclick=(e)=>{e.stopPropagation();deleteCoffeeReport(id);}; return btn;}}
    ];
    try {
        window.coffeeTable = new Tabulator(container, {
            data: [...(window.coffeeData || [])], columns: columns, layout:"fitColumns",
            pagination:"local", paginationSize:10, paginationSizeSelector:[5,10,20,50],
            placeholder:"Aucun signalement café.", movableColumns:true, locale:"fr-fr",
            langs:{"fr-fr":{"pagination":{"page_size":"Taille page","first":"<<","last":">>","prev":"<","next":">"},"headerFilters":{"default":"Filtrer..."}}}
        });
    } catch (e) { console.error("Erreur init coffeeTable:", e); showNotification("Erreur init table principale.", true); container.innerHTML = "<p style='color:red;'>Erreur init.</p>"; window.coffeeTable = null; }
}

export function initializeRechargeTable(initialData = []) {
    const container = document.getElementById('recharge-table-container');
    if (!container) { console.error("Conteneur #recharge-table-container introuvable !"); return; }
    if (window.rechargeTable) {
        console.log("SIGNALEMENTS CAFE: rechargeTable existe déjà. Mise à jour des données.");
        window.rechargeTable.setData(initialData).catch(e => console.error("Erreur setData rechargeTable (existante):", e));
        return;
    }
    console.log("SIGNALEMENTS CAFE: Initialisation rechargeTable avec", initialData.length, "lignes.");
    const columns = [
        { title: "Date Évén.", field: "dateEvenementRaw", width:110, hozAlign:"center", sorter:"date", sorterParams:{format:"YYYY-MM-DD"}, formatter:(c)=>c.getValue()||"-"},
        { title: "Heure Évén.", field: "heureEvenementRaw", width:90, hozAlign:"center", sorter:"time", sorterParams:{format:"HH:mm"}, formatter:(c)=>c.getValue()||"-"},
        { title: "Téléphone", field: "telephone", width:120, headerFilter:"input", formatter:(c)=>c.getValue()||"N/A"},
        { title: "Nom", field: "nom", minWidth:120, headerFilter:"input"},
        { title: "Email", field: "email", minWidth:150, formatter:"link", formatterParams:{urlPrefix:"mailto:"}, headerFilter:"input"},
        { title: "Machine", field: "machine", width:120, headerFilter:"input"},
        { title: "Paiement via", field: "paiement", width:110, headerFilter:"input", formatter:(c)=>c.getValue()||"N/A"},
        { title: "Détails", field: "commentaire", minWidth:150, formatter:"textarea", headerTooltip:true}
    ];
    try {
        window.rechargeTable = new Tabulator(container, {
            data: initialData, columns: columns, layout:"fitDataFill",
            pagination:"local", paginationSize:5, paginationSizeSelector:[5,10,15],
            placeholder:"Aucun problème de rechargement/paiement en cours.", movableColumns:true, locale:"fr-fr",
            langs:{"fr-fr":{"pagination":{"page_size":"Taille page","first":"<<","last":">>","prev":"<","next":">"},"headerFilters":{"default":"Filtrer..."}}}
        });
    } catch (e) { console.error("Erreur init rechargeTable:", e); showNotification("Erreur init table rechargements.", true); container.innerHTML = "<p style='color:red;'>Erreur init.</p>"; window.rechargeTable = null; }
}

// --- GRAPHIQUES ET STATISTIQUES ---
export function updateCoffeeStatsAndCharts(data = []) {
    console.log("SIGNALEMENTS CAFE: Mise à jour stats/graphiques avec", data.length, "lignes.");
    const statTotal = document.getElementById('stat-total-reports');
    const statEnCours = document.getElementById('stat-reports-en-cours');
    const statTraite = document.getElementById('stat-reports-traite');

    if (data.length === 0) {
        if(statTotal) statTotal.textContent = '0'; if(statEnCours) statEnCours.textContent = '0'; if(statTraite) statTraite.textContent = '0';
        if (window.problemChartInstance) { window.problemChartInstance.destroy(); window.problemChartInstance = null; }
        if (window.machineChartInstance) { window.machineChartInstance.destroy(); window.machineChartInstance = null; }
        if (window.statusChartInstance) { window.statusChartInstance.destroy(); window.statusChartInstance = null; }
        if (window.monthlyReportsChartInstance) { window.monthlyReportsChartInstance.destroy(); window.monthlyReportsChartInstance = null; }
        return;
    }

    const totalReports = data.length;
    const problemCounts={}, machineCounts={}, statusCounts={'en cours':0,'traité':0}, monthlyCounts={};
    const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth()-11); twelveMonthsAgo.setDate(1); twelveMonthsAgo.setHours(0,0,0,0);

    data.forEach(report => {
        problemCounts[report.probleme||"N/S"]=(problemCounts[report.probleme||"N/S"]||0)+1;
        machineCounts[report.machine||"N/S"]=(machineCounts[report.machine||"N/S"]||0)+1;
        const status=(report.status||'en cours').toLowerCase().trim();
        if(statusCounts.hasOwnProperty(status))statusCounts[status]++; else if(status==='')statusCounts['en cours']++;
        let reportDate;
        if(report.importTimestamp?.toDate)reportDate=report.importTimestamp.toDate();
        else if(report.importTimestamp)try{reportDate=new Date(report.importTimestamp);}catch(e){return;}
        else return;
        if(reportDate>=twelveMonthsAgo){const mKey=`${reportDate.getFullYear()}-${String(reportDate.getMonth()+1).padStart(2,'0')}`;monthlyCounts[mKey]=(monthlyCounts[mKey]||0)+1;}
    });

    if(statTotal) statTotal.textContent = totalReports; if(statEnCours) statEnCours.textContent = statusCounts['en cours']||0; if(statTraite) statTraite.textContent = statusCounts['traité']||0;

    const prep=(d,l=7)=>{let s=Object.entries(d).map(([k,v])=>({k,v})).sort((a,b)=>b.v-a.v),lb=[],vls=[],ot=0;if(s.length>l){lb=s.slice(0,l).map(i=>i.k);vls=s.slice(0,l).map(i=>i.v);ot=s.slice(l).reduce((sm,i)=>sm+i.v,0);if(ot>0){lb.push("Autres");vls.push(ot);}}else{lb=s.map(i=>i.k);vls=s.map(i=>i.v);}return{labels:lb,dataValues:vls};};
    const clrs=['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#FF9F40']; const bClrs=clrs.map(c=>c.replace('0.6','1'));
    const fSz=parseFloat(getComputedStyle(document.documentElement).fontSize)*0.7||10; // Taille de police ajustée
    const cOpts=(isY=false)=>({responsive:true,maintainAspectRatio:false,indexAxis:isY?'y':'x',scales:{[isY?'x':'y']:{beginAtZero:true,ticks:{stepSize:1,font:{size:fSz}}},[isY?'y':'x']:{ticks:{font:{size:fSz}}}},plugins:{legend:{display:false},tooltip:{bodyFont:{size:fSz+1},titleFont:{size:fSz+2}}}});

    const pCtx=document.getElementById('problem-chart')?.getContext('2d'); if(pCtx){const d=prep(problemCounts);if(window.problemChartInstance)window.problemChartInstance.destroy();window.problemChartInstance=new Chart(pCtx,{type:'bar',data:{labels:d.labels,datasets:[{data:d.dataValues,backgroundColor:clrs,borderColor:bClrs,borderWidth:1}]},options:cOpts(true)}); }
    const mCtx=document.getElementById('machine-chart')?.getContext('2d'); if(mCtx){const d=prep(machineCounts);if(window.machineChartInstance)window.machineChartInstance.destroy();window.machineChartInstance=new Chart(mCtx,{type:'bar',data:{labels:d.labels,datasets:[{data:d.dataValues,backgroundColor:clrs.slice(1).concat(clrs[0]),borderColor:bClrs.slice(1).concat(bClrs[0]),borderWidth:1}]},options:cOpts(false)}); }
    const sCtx=document.getElementById('status-chart')?.getContext('2d'); if(sCtx){const l=Object.keys(statusCounts),v=Object.values(statusCounts);const sClrs=[statusCounts['en cours']?'#FF9F40':'',statusCounts['traité']?'#4BC0C0':''].filter(Boolean);if(window.statusChartInstance)window.statusChartInstance.destroy();window.statusChartInstance=new Chart(sCtx,{type:'pie',data:{labels:l,datasets:[{data:v,backgroundColor:sClrs,borderColor:sClrs.map(c=>c.replace('0.7','1')),borderWidth:1}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:fSz}}}}}}); }

    const monthLabels=[], monthData=[]; const tmpD=new Date(twelveMonthsAgo);
    for(let i=0;i<12;i++){const y=tmpD.getFullYear(),m=tmpD.getMonth(),k=`${y}-${String(m+1).padStart(2,'0')}`;monthLabels.push(tmpD.toLocaleDateString('fr-FR',{month:'short',year:'numeric'}));monthData.push(monthlyCounts[k]||0);tmpD.setMonth(tmpD.getMonth()+1);}
    const monCtx=document.getElementById('monthly-reports-chart')?.getContext('2d');
    if(monCtx){if(window.monthlyReportsChartInstance)window.monthlyReportsChartInstance.destroy();window.monthlyReportsChartInstance=new Chart(monCtx,{type:'line',data:{labels:monthLabels,datasets:[{label:'Signalements',data:monthData,borderColor:'#4BC0C0',backgroundColor:'rgba(75,192,192,0.2)',tension:0.1,fill:true}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{stepSize:1,font:{size:fSz}}},x:{ticks:{font:{size:fSz}}}},plugins:{legend:{display:true,position:'top'},tooltip:{}}}});}
}

// --- ACTIONS SUR LES SIGNALEMENTS ---
async function updateCoffeeReportStatus(reportId, newStatus) {
    try {
        await fbUpdateStatus(COLLECTIONS.COFFEE, reportId, newStatus);
        showNotification(`Statut signalement mis à jour.`);
    } catch (e) { console.error("Erreur MàJ statut:", e); showNotification("Erreur MàJ statut.", true); }
}

async function deleteCoffeeReport(id) {
    if (!confirm("Effacer ce signalement ?")) return;
    try {
        await db.collection(COLLECTIONS.COFFEE).doc(id).delete();
        showNotification("Signalement effacé.");
    } catch (e) { console.error("Erreur suppression signalement:", e); showNotification("Erreur suppression.", true); }
}

// --- EXPORTS PDF ET CSV ---
function exportCoffeeEnCoursToPDF() {
    if (!window.coffeeTable) { showNotification("Tableau principal non prêt.", true); return; }
    if (typeof jspdf === 'undefined' || !jspdf.jsPDF?.API?.autoTable) { showNotification("Librairies PDF manquantes.", true); return; }
    const enCoursData = (window.coffeeData || []).filter(r => ((r.status||'en cours').toLowerCase().trim()==='en cours'||(r.status||'en cours').toLowerCase().trim()===''));
    if (enCoursData.length === 0) { showNotification("Aucun signalement 'en cours' à exporter.", false); return; }
    const tempDiv = document.createElement('div');
    const exportCols = [ /* Colonnes spécifiques pour cet export, sans formateurs complexes si possible */
        {title:"Date Signal.",field:"importTimestamp",formatter:(c)=>{const t=c.getValue(); return t?.toDate?t.toDate().toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):(t?new Date(t).toLocaleString('fr-FR'):"?");}},
        {title:"Téléphone",field:"telephone"}, {title:"Machine",field:"machine"}, {title:"Problème",field:"probleme"},
        {title:"Par",field:"nom"}, {title:"Email",field:"email"}, {title:"Opération",field:"operation"},
        {title:"Date Évén.",field:"dateEvenementRaw"}, {title:"Heure Évén.",field:"heureEvenementRaw"},
        {title:"Paiement",field:"paiement"}, {title:"Commentaire",field:"commentaire"} // autoTable gère le multiligne
    ];
    try {
        const tempTable = new Tabulator(tempDiv, { data: enCoursData, columns: exportCols, layout:"fitData" });
        setTimeout(() => { // Délai pour que Tabulator prépare les données
            try {
                tempTable.download("pdf", "signalements_cafe_en_cours.pdf", {
                    orientation: "landscape",
                    title: "Signalements Café (En Cours)", // Sera ignoré par autoTable, utiliser didDrawPage
                    autoTable: {
                        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
                        headStyles: { fillColor: [41,128,185], textColor: 255, fontSize: 8, fontStyle: 'bold' },
                        margin: { top: 20, right: 10, bottom: 10, left: 10 },
                        didDrawPage: function (data) {
                             const doc = data.doc; doc.setFontSize(16); doc.setTextColor(40);
                             doc.text("Signalements Café (En Cours)", data.settings.margin.left, 15);
                        }
                    }
                });
            } catch (dlErr) { console.error("Erreur download PDF:", dlErr); showNotification("Erreur génération PDF.", true); }
            finally { if (tempTable) tempTable.destroy(); }
        }, 200);
    } catch (tblErr) { console.error("Erreur création table temp PDF:", tblErr); showNotification("Erreur prép. export PDF.", true); }
}

// --- SETUP DES LISTENERS DU MODULE ---
export function setupCoffeeListeners() {
    console.log("SIGNALEMENTS CAFE: Attachement des listeners...");
    const exportRechargeCsvBtn = document.getElementById('export-recharge-csv-btn');
    const exportRechargePdfBtn = document.getElementById('export-recharge-pdf-btn');
    const exportCoffeeEnCoursPdfBtn = document.getElementById('export-coffee-en-cours-pdf-btn');

    if (exportRechargeCsvBtn) exportRechargeCsvBtn.addEventListener('click', () => {
        if (window.rechargeTable) window.rechargeTable.download("csv", "problemes_rechargement_cafe.csv", { delimiter: ";" });
        else showNotification("Tableau rechargements non prêt (CSV).", true);
    });
    if (exportRechargePdfBtn) exportRechargePdfBtn.addEventListener('click', () => {
        if (window.rechargeTable) {
            if (typeof jspdf === 'undefined' || !jspdf.jsPDF?.API?.autoTable) { showNotification("Librairies PDF manquantes.", true); return; }
            window.rechargeTable.download("pdf", "problemes_rechargement_cafe.pdf", { orientation: "landscape", title: "Problèmes Rechargement Café" }); // Titre géré par Tabulator ici
        } else showNotification("Tableau rechargements non prêt (PDF).", true);
    });
    if (exportCoffeeEnCoursPdfBtn) exportCoffeeEnCoursPdfBtn.addEventListener('click', exportCoffeeEnCoursToPDF);
    else console.warn("SIGNALEMENTS CAFE: Bouton #export-coffee-en-cours-pdf-btn non trouvé.");
}

// --- NETTOYAGE DU MODULE ---
export function cleanupCoffeeModule() {
    console.log("SIGNALEMENTS CAFE: Nettoyage du module...");
    const idsToDestroy = ['coffeeTable', 'rechargeTable', 'problemChartInstance', 'machineChartInstance', 'statusChartInstance', 'monthlyReportsChartInstance'];
    idsToDestroy.forEach(id => {
        if (window[id]) try { window[id].destroy(); } catch(e){ console.warn(`Erreur destruction ${id}:`, e); } finally { window[id] = null; }
    });
    const containersToClear = ['coffee-table-container', 'recharge-table-container'];
    containersToClear.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    // Les canvas sont nettoyés par la destruction des charts, pas besoin de clearRect manuellement ici.
}