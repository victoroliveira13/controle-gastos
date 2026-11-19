import type { PageServerLoad, Actions } from './$types';
import { getInitialBalance, setSetting, getSetting } from '$lib/server/db/settings';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = () => {
	return {
		initialBalance: getInitialBalance(),
		salary: {
			businessDay: parseInt(getSetting('salary_business_day', '5'), 10) || 5
		}
	};
};

export const actions: Actions = {
	saveInitialBalance: async ({ request }) => {
		const fd = await request.formData();
		const raw = String(fd.get('initialBalance') ?? '');
		const value = parseFloat(raw.replace(',', '.'));
		if (isNaN(value)) return fail(400, { error: 'Valor inválido' });
		setSetting('initial_balance', value.toString());
		return { success: true };
	},

	saveSalary: async ({ request }) => {
		const fd = await request.formData();
		const day = parseInt(String(fd.get('salaryBusinessDay') ?? '5'), 10);
		if (!(day >= 1 && day <= 23)) return fail(400, { error: 'Valores inválidos' });
		setSetting('salary_business_day', day.toString());
		return { success: true };
	}
};
