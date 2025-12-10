// =================================================================
// --- IMPORTAÇÕES DO FIREBASE ---
// =================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// =================================================================
// CONFIGURAÇÃO FIREBASE
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBLaOyPzX_lQE9yy6cksYC57InP96wsg3A", // Lembre-se de manter sua API Key original aqui
  authDomain: "clinicahcc-9b1c8.firebaseapp.com",
  databaseURL: "https://clinicahcc-9b1c8-default-rtdb.firebaseio.com",
  projectId: "clinicahcc-9b1c8",
  storageBucket: "clinicahcc-9b1c8.firebasestorage.app",
  messagingSenderId: "238456120590",
  appId: "1:238456120590:web:2c070d10f7e83597d5e35f",
  measurementId: "G-LG9QGXWV7Y"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// VARIAVEL DINÂMICA (Muda conforme quem loga)
let dbRef = ref(db, 'agendamentos'); // Padrão

// =================================================================
// 🔐 AUTENTICAÇÃO E ROTEAMENTO
// =================================================================

const telaLogin = document.getElementById('tela-login');
const sistemaPrincipal = document.getElementById('sistema-principal');
const formLogin = document.getElementById('form-login');
const msgErro = document.getElementById('msg-erro');
const tituloPrincipal = document.querySelector('.header-text h1');

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Pega o nome do email (ex: hedney)
        const emailUsuario = user.email.split('@')[0];
        
        // --- LÓGICA DE SEPARAÇÃO DOS SETORES ---
        if (emailUsuario.toLowerCase() === 'hedney') {
            // Se for o Hedney, muda para a pasta PILATES
            dbRef = ref(db, 'pilates');
            tituloPrincipal.innerText = "HCC - Setor Pilates 🧘‍♀️";
            tituloPrincipal.style.color = "#d4af37"; 
            document.title = "HCC - Pilates";
        } else {
            // Se for outro, vai para AGENDAMENTOS GERAL
            dbRef = ref(db, 'agendamentos');
            tituloPrincipal.innerText = "HCC - Harmony Clinical Center";
            document.title = "HCC - Harmony Clinical Center";
        }
        // -----------------------------------------

        const nomeFormatado = emailUsuario.charAt(0).toUpperCase() + emailUsuario.slice(1);
        mostrarSistema(nomeFormatado);
        
        // Recarrega os dados com a nova referência (dbRef) correta
        carregarDados();
    } else {
        telaLogin.style.display = 'flex';
        sistemaPrincipal.style.display = 'none';
    }
});

if (formLogin) {
    formLogin.addEventListener('submit', function(e) {
        e.preventDefault();
        let usuario = document.getElementById('login-usuario').value.trim().toLowerCase();
        const senha = document.getElementById('login-senha').value.trim();
        const emailCompleto = `${usuario}@hcc.com`;

        signInWithEmailAndPassword(auth, emailCompleto, senha)
            .then(() => msgErro.style.display = 'none')
            .catch((error) => {
                msgErro.style.display = 'block';
                msgErro.innerText = "Usuário ou senha incorretos!";
            });
    });
}

function mostrarSistema(nomeUsuario) {
    telaLogin.style.display = 'none';
    sistemaPrincipal.style.display = 'block';
    document.getElementById('usuario-logado').innerText = `Olá, ${nomeUsuario}`;
}

window.fazerLogout = function() {
    signOut(auth).then(() => location.reload());
};

// =================================================================
// LÓGICA DO SISTEMA
// =================================================================

const form = document.getElementById('form-atendimento');
const listaClientes = document.getElementById('lista-clientes');
const campoDataCadastro = document.getElementById('data');
const gridHorarios = document.getElementById('grid-horarios');
const tituloMapa = document.getElementById('data-titulo-mapa');
const campoFiltro = document.getElementById('filtro-data-lista');

let atendimentos = [];
const hoje = new Date().toISOString().split('T')[0];

// Inicialização de datas
if(campoDataCadastro) campoDataCadastro.value = hoje;
if(campoFiltro) {
    campoFiltro.value = hoje;
    campoFiltro.addEventListener('change', atualizarTela);
}
if(campoDataCadastro) campoDataCadastro.addEventListener('change', () => gerarMapaHorarios(campoDataCadastro.value));


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

// Carregar Dados (Usa dbRef dinâmico)
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
        if(campoDataCadastro) gerarMapaHorarios(campoDataCadastro.value);
    });
}

// --- FUNÇÃO ATUALIZAR LISTA COM FILTRO E SOMAS ---
function atualizarTela() {
    if(!listaClientes) return;
    listaClientes.innerHTML = '';
    
    let somaDiaConfirmado = 0; 
    let somaDiaPrevisto = 0; 
    let somaMesConfirmado = 0;
    let somaMesExpectativa = 0; // Soma acumulada (Pendentes + Confirmados) do Mês
    
    // Filtro Data
    const dataFiltro = campoFiltro ? campoFiltro.value : hoje;
    const mesAtualIso = new Date().toISOString().slice(0, 7); // Ex: 2023-10
    
    // Atualiza título do mapa (visual)
    if(tituloMapa) tituloMapa.innerText = `(${dataFiltro.split('-').reverse().join('/')})`;
    
    atendimentos.sort((a, b) => a.horario.localeCompare(b.horario));

    let temAgendamento = false;

    atendimentos.forEach(item => {
        // --- RENDERIZAÇÃO DA TABELA (APENAS DATA SELECIONADA) ---
        if (item.data === dataFiltro) {
            temAgendamento = true;

            if (item.status === 'concluido') somaDiaConfirmado += item.valor;
            if (item.status === 'pendente') somaDiaPrevisto += item.valor;

            const linha = document.createElement('tr');
            linha.className = item.status;
            linha.innerHTML = `
                <td><strong>${item.horario}</strong></td>
                <td>${item.cliente}</td>
                <td>${item.procedimento}</td>
                <td>R$ ${item.valor.toFixed(2).replace('.', ',')}</td>
                <td>
                    <div class="acoes-container">
                        <button onclick="window.marcarCompareceu('${item.id}')" class="btn-acao btn-ok" title="Concluir"><i class="fas fa-check"></i></button>
                        <button onclick="window.abrirModalRemarcar('${item.id}')" class="btn-acao btn-remarcar" title="Remarcar"><i class="fas fa-calendar-alt"></i></button>
                        <button onclick="window.marcarCancelou('${item.id}')" class="btn-acao btn-cancel" title="Cancelar"><i class="fas fa-ban"></i></button>
                        <button onclick="window.excluirDefinitivo('${item.id}')" class="btn-acao btn-trash" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            listaClientes.appendChild(linha);
        }

        // --- CÁLCULOS FINANCEIROS DO MÊS ---
        if (item.data.startsWith(mesAtualIso)) {
            // Soma apenas o que já está pago
            if (item.status === 'concluido') {
                somaMesConfirmado += item.valor;
            }
            // Soma TUDO que não foi cancelado (Confirmado + Pendente) = Expectativa
            if (item.status !== 'cancelado') {
                somaMesExpectativa += item.valor;
            }
        }
    });

    // Mensagem se vazio
    if(!temAgendamento) {
        listaClientes.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #999;">Nenhum cliente em ${dataFiltro.split('-').reverse().join('/')}</td></tr>`;
    }

    // --- ATUALIZAÇÃO DOS TOTAIS NA TELA ---
    
    // TOTAIS DO DIA
    const labelTotalDia = document.querySelector('.total-dia span');
    if(labelTotalDia) labelTotalDia.innerHTML = `<i class="fas fa-coins"></i> Em ${dataFiltro.split('-').reverse().join('/')}:`;

    if(document.getElementById('total-dia')) 
        document.getElementById('total-dia').innerText = `R$ ${somaDiaConfirmado.toFixed(2).replace('.', ',')}`;
    
    if(document.getElementById('previsao-dia')) 
        document.getElementById('previsao-dia').innerText = `(A receber: R$ ${somaDiaPrevisto.toFixed(2).replace('.', ',')})`;

    // TOTAIS DO MÊS
    if(document.getElementById('total-mes')) 
        document.getElementById('total-mes').innerText = `R$ ${somaMesConfirmado.toFixed(2).replace('.', ',')}`;
    
    // ATUALIZA A NOVA LINHA DE EXPECTATIVA DO MÊS
    if(document.getElementById('previsao-mes')) {
        document.getElementById('previsao-mes').innerText = `(Expectativa: R$ ${somaMesExpectativa.toFixed(2).replace('.', ',')})`;
    }
}

// Mapa de Horários
function gerarMapaHorarios(dataSelecionada) {
    if(!gridHorarios) return;
    gridHorarios.innerHTML = ''; 
    
    if(tituloMapa && document.getElementById('data').value === dataSelecionada) {
        tituloMapa.innerText = `(${dataSelecionada.split('-').reverse().join('/')})`;
    }

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
                div.onclick = function() { 
                    document.getElementById('horario').value = horaSlotStr; 
                    document.getElementById('cliente').focus(); 
                };
            }
            gridHorarios.appendChild(div);
        });
    }
}

// Auxiliares
function formatarHora(h, m) { return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

function arredondarHorario(horarioStr) {
    if(!horarioStr) return "";
    let [h, m] = horarioStr.split(':').map(Number);
    if (m < 15) m = 0; else if (m < 45) m = 30; else { m = 0; h = h + 1; }
    if (h > 22) h = 22; if (h < 7) h = 7; 
    return formatarHora(h, m);
}

function verificarConflito(data, horario, ignorarId = null) {
    return atendimentos.some(a => a.data === data && a.horario === horario && a.status !== 'cancelado' && a.id !== ignorarId);
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
        if (verificarConflito(data, horario)) { if(!confirm(`Horário ${horario} ocupado. Encaixar?`)) return; }

        push(dbRef, { cliente, procedimento, data, horario, valor, status: 'pendente' });
        form.reset();
        document.getElementById('data').value = data; 
        gerarMapaHorarios(data);
    });
}

// Importar
window.importarDados = function() {
    const texto = document.getElementById('campo-importar').value;
    if (!texto.trim()) { alert("Cole o texto primeiro!"); return; }
    const linhas = texto.split('\n'); let contador = 0;
    
    linhas.forEach(linha => {
        if (!linha.trim()) return;
        const partes = linha.split(',').map(p => p.trim());
        if (partes.length >= 5) {
            const nome = partes[0]; const proc = partes[1]; const dataRaw = partes[2]; const horaRaw = partes[3]; const valorStr = partes[4];
            let dataFinalIso = ""; const dataObj = new Date();
            const anoAtual = dataObj.getFullYear();

            if (!dataRaw.includes('/')) { 
                const mes = String(dataObj.getMonth() + 1).padStart(2, '0'); 
                dataFinalIso = `${anoAtual}-${mes}-${String(dataRaw).padStart(2, '0')}`; 
            } else { 
                const p = dataRaw.split('/'); 
                if (p.length === 2) dataFinalIso = `${anoAtual}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
            }
            const valorFinal = parseFloat(valorStr.replace(',', '.'));
            const horaFinal = arredondarHorario(horaRaw);
            
            if(dataFinalIso && !isNaN(valorFinal)) {
                push(dbRef, { cliente: nome, procedimento: proc, data: dataFinalIso, horario: horaFinal, valor: valorFinal, status: 'pendente' });
                contador++;
            }
        }
    });
    if (contador > 0) { alert(`${contador} importados para o setor atual!`); document.getElementById('campo-importar').value = ''; }
    else { alert("Verifique o formato: Nome, Procedimento, Dia, Hora, Valor"); }
};

// Funções Globais (Ações)
window.marcarCompareceu = function(id) { 
    const pathBase = dbRef.toString().includes('pilates') ? 'pilates' : 'agendamentos';
    update(ref(db, `${pathBase}/${id}`), { status: 'concluido' }); 
};

window.marcarCancelou = function(id) { 
    if(confirm("Cancelar?")) {
        const pathBase = dbRef.toString().includes('pilates') ? 'pilates' : 'agendamentos';
        update(ref(db, `${pathBase}/${id}`), { status: 'cancelado' }); 
    }
};

window.excluirDefinitivo = function(id) { 
    if(confirm("Excluir pra sempre?")) {
        const pathBase = dbRef.toString().includes('pilates') ? 'pilates' : 'agendamentos';
        remove(ref(db, `${pathBase}/${id}`)); 
    }
};

window.limparTudo = function() {
    if(confirm("PERIGO: Isso apaga TODOS os dados DESTE SETOR. Tem certeza?")) remove(dbRef);
};

// Remarcar
window.abrirModalRemarcar = function(id) {
    const item = atendimentos.find(a => a.id === id);
    if(item) {
        document.getElementById('id-para-remarcar').value = id;
        document.getElementById('nova-data-modal').value = item.data;
        document.getElementById('novo-horario-modal').value = item.horario;
        document.getElementById('modal-remarcar').style.display = 'flex';
    }
};
window.fecharModal = function() { document.getElementById('modal-remarcar').style.display = 'none'; };

window.confirmarRemarcacao = function() {
    const id = document.getElementById('id-para-remarcar').value;
    const novaData = document.getElementById('nova-data-modal').value;
    const novoHorario = document.getElementById('novo-horario-modal').value;
    
    if(!novaData || !novoHorario) return;
    if(verificarConflito(novaData, novoHorario, id)) { if(!confirm("Horário ocupado. Manter?")) return; }
    
    const pathBase = dbRef.toString().includes('pilates') ? 'pilates' : 'agendamentos';
    update(ref(db, `${pathBase}/${id}`), { data: novaData, horario: novoHorario, status: 'pendente' }).then(() => {
        alert("Remarcado!"); fecharModal();
    });
};

// Exportar
window.exportarRelatorio = function() {
    if (atendimentos.length === 0) { alert("Nada para exportar."); return; }
    let lucroTotal = 0;
    const nomeSetor = dbRef.toString().includes('pilates') ? 'PILATES' : 'ESTETICA';
    
    let tabela = `<table border="1"><thead><tr style="background-color:#222;color:#d4af37;"><th>Data</th><th>Horário</th><th>Cliente</th><th>Procedimento</th><th>Valor</th><th>Status</th></tr></thead><tbody>`;
    atendimentos.forEach(item => {
        const dt = item.data.split('-').reverse().join('/');
        const val = item.valor.toFixed(2).replace('.', ',');
        let bgStatus="#fff"; let st="Pendente";
        if (item.status === 'concluido') { st='Concluído'; bgStatus="#d4edda"; lucroTotal += item.valor; } 
        else if (item.status === 'cancelado') { st='Cancelado'; bgStatus="#f8d7da"; }
        tabela += `<tr><td>${dt}</td><td>${item.horario}</td><td>${item.cliente}</td><td>${item.procedimento}</td><td>R$ ${val}</td><td style="background-color:${bgStatus};">${st}</td></tr>`;
    });
    const totalFmt = lucroTotal.toFixed(2).replace('.', ',');
    tabela += `<tr><td colspan="4" style="text-align:right;">TOTAL LUCRO (${nomeSetor}):</td><td style="background-color:#d4af37;color:white;">R$ ${totalFmt}</td><td></td></tr></tbody></table>`;
    
    const blob = new Blob(['\ufeff', tabela], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Relatorio_HCC_${nomeSetor}.xls`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
};