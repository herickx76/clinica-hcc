// --- IMPORTAÇÕES DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Importamos as ferramentas de Autenticação Segura
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =================================================================
// ⚠️ ÁREA DE CONFIGURAÇÃO - COLE SEU CÓDIGO DO FIREBASE ABAIXO ⚠️
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBLaOyPzX_lQE9yy6cksYC57InP96wsg3A",
  authDomain: "clinicahcc-9b1c8.firebaseapp.com",
  databaseURL: "https://clinicahcc-9b1c8-default-rtdb.firebaseio.com",
  projectId: "clinicahcc-9b1c8",
  storageBucket: "clinicahcc-9b1c8.firebasestorage.app",
  messagingSenderId: "238456120590",
  appId: "1:238456120590:web:2c070d10f7e83597d5e35f",
  measurementId: "G-LG9QGXWV7Y"
};

// =================================================================

// Inicializa Firebase e Auth
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // Sistema de autenticação
const dbRef = ref(db, 'agendamentos');

// =================================================================
// 🔐 SISTEMA DE LOGIN BLINDADO (FIREBASE AUTH)
// =================================================================

const telaLogin = document.getElementById('tela-login');
const sistemaPrincipal = document.getElementById('sistema-principal');
const formLogin = document.getElementById('form-login');
const msgErro = document.getElementById('msg-erro');

// Monitora o estado (Se a pessoa fechou a aba e voltou, o Google lembra dela)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuário está logado
        const nomeExibicao = user.email.split('@')[0]; // Pega "ingridy" do email
        const nomeFormatado = nomeExibicao.charAt(0).toUpperCase() + nomeExibicao.slice(1);
        mostrarSistema(nomeFormatado);
        
        // Só carrega os dados SE estiver logado (Segurança extra)
        carregarDados();
    } else {
        // Usuário não está logado
        telaLogin.style.display = 'flex';
        sistemaPrincipal.style.display = 'none';
    }
});

// Função de Login
if (formLogin) {
    formLogin.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let usuario = document.getElementById('login-usuario').value.trim().toLowerCase();
        const senha = document.getElementById('login-senha').value.trim();
        
        // Adiciona o domínio automaticamente para facilitar pra elas
        // Elas digitam "ingridy", o sistema entende "ingridy@hcc.com"
        const emailCompleto = `${usuario}@hcc.com`;

        signInWithEmailAndPassword(auth, emailCompleto, senha)
            .then((userCredential) => {
                // Sucesso! O onAuthStateChanged vai lidar com a tela
                msgErro.style.display = 'none';
            })
            .catch((error) => {
                console.error("Erro login:", error.code);
                msgErro.style.display = 'block';
                
                if(error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    msgErro.innerText = "Usuário ou senha incorretos!";
                } else if (error.code === 'auth/too-many-requests') {
                    msgErro.innerText = "Muitas tentativas. Aguarde um pouco.";
                } else {
                    msgErro.innerText = "Erro ao acessar: " + error.code;
                }
            });
    });
}

function mostrarSistema(nomeUsuario) {
    telaLogin.style.display = 'none';
    sistemaPrincipal.style.display = 'block';
    document.getElementById('usuario-logado').innerText = `Olá, ${nomeUsuario}`;
}

window.fazerLogout = function() {
    signOut(auth).then(() => {
        // Saiu com sucesso, a tela de login volta automaticamente
        location.reload();
    }).catch((error) => {
        alert("Erro ao sair.");
    });
};

// =================================================================
// LÓGICA DO SISTEMA
// =================================================================

const form = document.getElementById('form-atendimento');
const listaClientes = document.getElementById('lista-clientes');
const campoData = document.getElementById('data');
const gridHorarios = document.getElementById('grid-horarios');
const tituloMapa = document.getElementById('data-titulo-mapa');
const modal = document.getElementById('modal-remarcar');
const inputIdRemarcar = document.getElementById('id-para-remarcar');
const inputDataRemarcar = document.getElementById('nova-data-modal');
const inputHoraRemarcar = document.getElementById('novo-horario-modal');

let atendimentos = [];
const hoje = new Date().toISOString().split('T')[0];
if(campoData) campoData.value = hoje;

function popularSelectsHorario() {
    const selectPrincipal = document.getElementById('horario');
    const selectModal = document.getElementById('novo-horario-modal');
    if(!selectPrincipal || !selectModal) return;

    selectPrincipal.innerHTML = '<option value="">Selecione...</option>';
    selectModal.innerHTML = '';
    const inicio = 7; const fim = 22;
    for (let h = inicio; h <= fim; h++) {
        const minutos = ["00", "30"];
        minutos.forEach(min => {
            if (h === fim && min === "30") return;
            const horaFmt = `${String(h).padStart(2, '0')}:${min}`;
            const opt1 = document.createElement('option'); opt1.value = horaFmt; opt1.textContent = horaFmt; selectPrincipal.appendChild(opt1);
            const opt2 = document.createElement('option'); opt2.value = horaFmt; opt2.textContent = horaFmt; selectModal.appendChild(opt2);
        });
    }
}
popularSelectsHorario();

// Função para carregar dados (Só é chamada após login)
function carregarDados() {
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        atendimentos = []; 
        if (data) {
            Object.keys(data).forEach(key => {
                atendimentos.push({ id: key, ...data[key] });
            });
        }
        atualizarTela();
    }, (error) => {
        console.error("Erro ao ler dados:", error);
        // Se der erro de permissão, é pq não está logado corretamente
    });
}

if(campoData) campoData.addEventListener('change', atualizarTela);

function formatarHora(h, m) { return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
function arredondarHorario(horarioStr) {
    if(!horarioStr) return "";
    let [h, m] = horarioStr.split(':').map(Number);
    if (m < 15) m = 0; else if (m < 45) m = 30; else { m = 0; h = h + 1; }
    if (h > 22) h = 22; if (h < 7) h = 7; 
    return formatarHora(h, m);
}

// Cadastrar
if(form) {
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const cliente = document.getElementById('cliente').value;
        const procedimento = document.getElementById('procedimento').value;
        const data = document.getElementById('data').value;
        const horario = document.getElementById('horario').value;
        const valor = parseFloat(document.getElementById('valor').value);

        if(!horario) { alert("Selecione um horário!"); return; }
        if (verificarConflito(data, horario)) { if(!confirm(`Horário ${horario} já está ocupado. Encaixar?`)) return; }

        push(dbRef, { cliente, procedimento, data, horario, valor, status: 'pendente' });
        form.reset();
        document.getElementById('data').value = data; 
        document.getElementById('cliente').focus();
    });
}

function verificarConflito(data, horario, ignorarId = null) {
    return atendimentos.some(a => a.data === data && a.horario === horario && a.status !== 'cancelado' && a.id !== ignorarId);
}

// Mapa
function gerarMapaHorarios(dataSelecionada) {
    if(!gridHorarios) return;
    gridHorarios.innerHTML = ''; 
    const horaInicio = 7; const horaFim = 22;
    const agendamentosDoDia = atendimentos.filter(a => a.data === dataSelecionada && a.status !== 'cancelado');
    for (let h = horaInicio; h <= horaFim; h++) {
        const minutos = ["00", "30"];
        minutos.forEach(min => {
            if (h === horaFim && min === "30") return;
            const horaSlotStr = formatarHora(h, min);
            const ocupante = agendamentosDoDia.find(a => a.horario === horaSlotStr);
            const div = document.createElement('div');
            if (ocupante) {
                div.className = 'slot ocupado';
                div.innerHTML = `<strong>${horaSlotStr}</strong><span>${ocupante.cliente.split(' ')[0]}</span>`;
            } else {
                div.className = 'slot livre';
                div.innerHTML = `<strong>${horaSlotStr}</strong><span>LIVRE</span>`;
                div.onclick = function() { document.getElementById('horario').value = horaSlotStr; document.getElementById('cliente').focus(); };
            }
            gridHorarios.appendChild(div);
        });
    }
}

// Atualizar Tela
function atualizarTela() {
    if(!listaClientes) return;
    listaClientes.innerHTML = '';
    let somaDiaConfirmado = 0; let somaDiaPrevisto = 0; let somaMesConfirmado = 0;
    const dataInput = document.getElementById('data') ? document.getElementById('data').value : hoje;
    const mesAtualIso = new Date().toISOString().slice(0, 7);
    if(dataInput && tituloMapa) { tituloMapa.innerText = `(${dataInput.split('-').reverse().join('/')})`; gerarMapaHorarios(dataInput); }
    atendimentos.sort((a, b) => {
        if (a.data !== b.data) return a.data.localeCompare(b.data);
        return a.horario.localeCompare(b.horario);
    });
    atendimentos.forEach(item => {
        if (item.data === dataInput) {
            if (item.status === 'concluido') somaDiaConfirmado += item.valor;
            if (item.status === 'pendente') somaDiaPrevisto += item.valor;
        }
        if (item.data.startsWith(mesAtualIso) && item.status === 'concluido') somaMesConfirmado += item.valor;
        const dataPt = item.data.split('-').reverse().join('/');
        const linha = document.createElement('tr');
        linha.className = item.status;
        linha.innerHTML = `
            <td><strong>${dataPt}</strong><br><small>${item.horario}</small></td>
            <td>${item.cliente}</td>
            <td>${item.procedimento}</td>
            <td>R$ ${item.valor.toFixed(2).replace('.', ',')}</td>
            <td>
                <div class="acoes-container">
                    <button onclick="window.marcarCompareceu('${item.id}')" class="btn-acao btn-ok"><i class="fas fa-check"></i></button>
                    <button onclick="window.abrirModalRemarcar('${item.id}')" class="btn-acao btn-remarcar"><i class="fas fa-calendar-alt"></i></button>
                    <button onclick="window.marcarCancelou('${item.id}')" class="btn-acao btn-cancel"><i class="fas fa-ban"></i></button>
                    <button onclick="window.excluirDefinitivo('${item.id}')" class="btn-acao btn-trash"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        listaClientes.appendChild(linha);
    });
    if(document.getElementById('total-dia')) document.getElementById('total-dia').innerText = `R$ ${somaDiaConfirmado.toFixed(2).replace('.', ',')}`;
    if(document.getElementById('previsao-dia')) document.getElementById('previsao-dia').innerText = `(Pendente: R$ ${somaDiaPrevisto.toFixed(2).replace('.', ',')})`;
    if(document.getElementById('total-mes')) document.getElementById('total-mes').innerText = `R$ ${somaMesConfirmado.toFixed(2).replace('.', ',')}`;
}

// Exportar Excel Profissional
window.exportarRelatorio = function() {
    if (atendimentos.length === 0) { alert("Nada para exportar."); return; }
    let lucroTotal = 0;
    let tabela = `<table border="1"><thead><tr style="background-color:#222;color:#d4af37;"><th>Data</th><th>Horário</th><th>Cliente</th><th>Procedimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>`;
    atendimentos.forEach(item => {
        const dt = item.data.split('-').reverse().join('/');
        const val = item.valor.toFixed(2).replace('.', ',');
        let corStatus="#000"; let bgStatus="#fff"; let st="Pendente";
        if (item.status === 'concluido') { st='Concluído'; bgStatus="#d4edda"; corStatus="#155724"; lucroTotal += item.valor; } 
        else if (item.status === 'cancelado') { st='Cancelado'; bgStatus="#f8d7da"; corStatus="#721c24"; }
        tabela += `<tr><td>${dt}</td><td>${item.horario}</td><td>${item.cliente}</td><td>${item.procedimento}</td><td>R$ ${val}</td><td style="background-color:${bgStatus};color:${corStatus};">${st}</td></tr>`;
    });
    const totalFmt = lucroTotal.toFixed(2).replace('.', ',');
    tabela += `<tr><td colspan="4" style="text-align:right;font-weight:bold;">TOTAL LUCRO (Concluídos):</td><td style="background-color:#d4af37;color:white;">R$ ${totalFmt}</td><td></td></tr></tbody></table>`;
    const hojeObj = new Date();
    const nomeArquivo = `Relatorio - ${String(hojeObj.getDate()).padStart(2,'0')}${String(hojeObj.getMonth()+1).padStart(2,'0')}${hojeObj.getFullYear()}.xls`;
    const blob = new Blob(['\ufeff', tabela], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nomeArquivo; document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// Globais
window.importarDados = function() {
    const texto = document.getElementById('campo-importar').value;
    if (!texto.trim()) { alert("Cole o texto primeiro!"); return; }
    const linhas = texto.split('\n'); let contador = 0;
    linhas.forEach(linha => {
        if (!linha.trim()) return;
        const partes = linha.split(',');
        if (partes.length >= 5) {
            const nome = partes[0].trim(); const proc = partes[1].trim(); const dataRaw = partes[2].trim(); const horaRaw = partes[3].trim(); const valorStr = partes[4].trim();
            let dataFinalIso = ""; const dataObj = new Date();
            if (!dataRaw.includes('/')) { const ano = dataObj.getFullYear(); const mes = String(dataObj.getMonth() + 1).padStart(2, '0'); dataFinalIso = `${ano}-${mes}-${String(dataRaw).padStart(2, '0')}`; } 
            else { const p = dataRaw.split('/'); if (p.length === 2) dataFinalIso = `${dataObj.getFullYear()}-${p[1]}-${p[0]}`; else if (p.length === 3) dataFinalIso = `${p[2]}-${p[1]}-${p[0]}`; }
            let horaBruta = ""; if (horaRaw.includes(':')) horaBruta = horaRaw.length === 4 ? "0"+horaRaw : horaRaw; else horaBruta = `${String(parseInt(horaRaw)).padStart(2, '0')}:00`;
            const horaFinal = arredondarHorario(horaBruta); const valorFloat = parseFloat(valorStr.replace('R$', '').trim());
            if (!isNaN(valorFloat) && dataFinalIso !== "") { push(dbRef, { cliente: nome, procedimento: proc, data: dataFinalIso, horario: horaFinal, valor: valorFloat, status: 'pendente' }); contador++; }
        }
    });
    if (contador > 0) { document.getElementById('campo-importar').value = ''; alert(`${contador} importados!`); } else { alert("Use vírgulas."); }
};

window.marcarCompareceu = function(id) { update(ref(db, `agendamentos/${id}`), { status: 'concluido' }); };
window.marcarCancelou = function(id) { if(confirm("Cancelar?")) update(ref(db, `agendamentos/${id}`), { status: 'cancelado' }); };
window.excluirDefinitivo = function(id) { if(confirm("Apagar?")) remove(ref(db, `agendamentos/${id}`)); };
window.limparTudo = function() { if(confirm('APAGAR TUDO?')) remove(dbRef); };
window.abrirModalRemarcar = function(id) { const i = atendimentos.find(x => x.id===id); if(i){ inputIdRemarcar.value=id; inputDataRemarcar.value=i.data; inputHoraRemarcar.value=i.horario; modal.style.display='flex'; } };
window.fecharModal = function() { modal.style.display='none'; };
window.confirmarRemarcacao = function() {
    const id = inputIdRemarcar.value; const nData = inputDataRemarcar.value; const nHora = inputHoraRemarcar.value;
    if(!nData || !nHora){ alert("Preencha tudo"); return; }
    const item = atendimentos.find(x => x.id===id);
    if(item) {
        if(verificarConflito(nData, nHora, id)) if(!confirm(`Horário ${nHora} ocupado! Encaixar?`)) return;
        update(ref(db, `agendamentos/${id}`), { data: nData, horario: nHora, status: 'pendente' });
        fecharModal();
    }
};