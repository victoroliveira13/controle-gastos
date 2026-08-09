import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { categoryGroups, categories } from './schema.js';

const DB_URL = process.env.DATABASE_URL ?? 'local.db';
const client = new Database(DB_URL);
const db = drizzle(client);

const GROUPS = [
	{ code: 'R', name: 'Receita', isIncome: true },
	{ code: 'A', name: 'Alimentação', isIncome: false },
	{ code: 'M', name: 'Moradia', isIncome: false },
	{ code: 'E', name: 'Educação', isIncome: false },
	{ code: 'C', name: 'Animais', isIncome: false },
	{ code: 'S', name: 'Saúde', isIncome: false },
	{ code: 'T', name: 'Transporte', isIncome: false },
	{ code: 'P', name: 'Pessoais', isIncome: false },
	{ code: 'L', name: 'Lazer', isIncome: false },
	{ code: 'F', name: 'Serviços Financeiros', isIncome: false }
];

const CATEGORIES = [
	{ code: 'R1', groupCode: 'R', name: 'Salário / Adiantamento / Renda Autônomo' },
	{ code: 'R2', groupCode: 'R', name: 'Férias' },
	{ code: 'R3', groupCode: 'R', name: '13º salário' },
	{ code: 'R4', groupCode: 'R', name: 'Aposentadoria' },
	{ code: 'R5', groupCode: 'R', name: 'Receita extra (aluguel, restituição IR)' },
	{ code: 'R6', groupCode: 'R', name: 'Outras Receitas' },
	{ code: 'A1', groupCode: 'A', name: 'Supermercado' },
	{ code: 'A2', groupCode: 'A', name: 'Feira / Sacolão' },
	{ code: 'A3', groupCode: 'A', name: 'Padaria' },
	{ code: 'A4', groupCode: 'A', name: 'Refeição fora de casa' },
	{ code: 'A5', groupCode: 'A', name: 'Outros (café, água, sorvetes, etc)' },
	{ code: 'M1', groupCode: 'M', name: 'Prestação / Aluguel de imóvel' },
	{ code: 'M2', groupCode: 'M', name: 'Condomínio' },
	{ code: 'M3', groupCode: 'M', name: 'Consumo de água' },
	{ code: 'M4', groupCode: 'M', name: 'Serviço de limpeza (diarista ou mensalista)' },
	{ code: 'M5', groupCode: 'M', name: 'Energia Elétrica' },
	{ code: 'M6', groupCode: 'M', name: 'Gás' },
	{ code: 'M7', groupCode: 'M', name: 'IPTU' },
	{ code: 'M8', groupCode: 'M', name: 'Decoração da casa' },
	{ code: 'M9', groupCode: 'M', name: 'Manutenção / Reforma da casa' },
	{ code: 'M10', groupCode: 'M', name: 'Celular' },
	{ code: 'M11', groupCode: 'M', name: 'Telefone fixo' },
	{ code: 'M12', groupCode: 'M', name: 'Internet / TV a cabo' },
	{ code: 'E1', groupCode: 'E', name: 'Matrícula Escolar / Mensalidade' },
	{ code: 'E2', groupCode: 'E', name: 'Material Escolar' },
	{ code: 'E3', groupCode: 'E', name: 'Outros cursos' },
	{ code: 'E4', groupCode: 'E', name: 'Transporte escolar' },
	{ code: 'C1', groupCode: 'C', name: 'Ração' },
	{ code: 'C2', groupCode: 'C', name: 'Banho / Tosa' },
	{ code: 'C3', groupCode: 'C', name: 'Veterinário / medicamento' },
	{ code: 'C4', groupCode: 'C', name: 'Outros (acessórios, brinquedos, hotel, dog walker)' },
	{ code: 'S1', groupCode: 'S', name: 'Plano de saúde' },
	{ code: 'S2', groupCode: 'S', name: 'Medicamentos' },
	{ code: 'S3', groupCode: 'S', name: 'Dentista' },
	{ code: 'S4', groupCode: 'S', name: 'Terapia / Psicólogo / Acupuntura' },
	{ code: 'S5', groupCode: 'S', name: 'Médicos / Exames fora do plano de saúde' },
	{ code: 'S6', groupCode: 'S', name: 'Academia / Tratamento Estético' },
	{ code: 'T1', groupCode: 'T', name: 'Ônibus / Metrô' },
	{ code: 'T2', groupCode: 'T', name: 'Taxi' },
	{ code: 'T3', groupCode: 'T', name: 'Combustível' },
	{ code: 'T4', groupCode: 'T', name: 'Estacionamento' },
	{ code: 'T5', groupCode: 'T', name: 'Seguro Auto' },
	{ code: 'T6', groupCode: 'T', name: 'Manutenção / Lavagem / Troca de óleo' },
	{ code: 'T7', groupCode: 'T', name: 'Licenciamento' },
	{ code: 'T8', groupCode: 'T', name: 'Pedágio' },
	{ code: 'T9', groupCode: 'T', name: 'IPVA' },
	{ code: 'P1', groupCode: 'P', name: 'Vestuário / Calçados / Acessórios' },
	{ code: 'P2', groupCode: 'P', name: 'Cabeleireiro / Manicure / Higiene pessoal' },
	{ code: 'P3', groupCode: 'P', name: 'Presentes' },
	{ code: 'P4', groupCode: 'P', name: 'Outros' },
	{ code: 'L1', groupCode: 'L', name: 'Cinema / Teatro / Shows' },
	{ code: 'L2', groupCode: 'L', name: 'Livros / Revistas / CDs' },
	{ code: 'L3', groupCode: 'L', name: 'Clube / Parques / Casa Noturna' },
	{ code: 'L4', groupCode: 'L', name: 'Viagens' },
	{ code: 'L5', groupCode: 'L', name: 'Restaurantes / Bares / Festas' },
	{ code: 'F1', groupCode: 'F', name: 'Empréstimos' },
	{ code: 'F2', groupCode: 'F', name: 'Seguros (vida/residencial)' },
	{ code: 'F3', groupCode: 'F', name: 'Investimentos (Reservas / Poupança / Outros)' },
	{ code: 'F4', groupCode: 'F', name: 'Juros Cheque Especial' },
	{ code: 'F5', groupCode: 'F', name: 'Tarifas bancárias' },
	{ code: 'F6', groupCode: 'F', name: 'Financiamento de veículo' },
	{ code: 'F7', groupCode: 'F', name: 'Pagamento da fatura do cartão de crédito' },
	{ code: 'F8', groupCode: 'F', name: 'Imposto de Renda a Pagar' },
	{ code: 'F9', groupCode: 'F', name: 'Saque' }
];

db.insert(categoryGroups)
	.values(GROUPS)
	.onConflictDoNothing()
	.run();

const insertedGroups = db.select().from(categoryGroups).all();
const groupMap = new Map(insertedGroups.map((g) => [g.code, g.id]));

db.insert(categories)
	.values(
		CATEGORIES.map((c) => ({
			code: c.code,
			groupId: groupMap.get(c.groupCode)!,
			name: c.name,
			isDefault: true,
			isActive: true
		}))
	)
	.onConflictDoNothing()
	.run();

console.log(`✅ Seed concluído: ${GROUPS.length} grupos, ${CATEGORIES.length} categorias`);
client.close();
