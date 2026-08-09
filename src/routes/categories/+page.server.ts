import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/index';
import { categories, categoryGroups } from '$lib/server/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = () => {
	const rows = db
		.select({
			id: categories.id,
			code: categories.code,
			name: categories.name,
			isDefault: categories.isDefault,
			isActive: categories.isActive,
			groupId: categories.groupId,
			groupCode: categoryGroups.code,
			groupName: categoryGroups.name,
			isIncome: categoryGroups.isIncome
		})
		.from(categories)
		.innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
		.orderBy(asc(sql`${categoryGroups.code}`), asc(sql`${categories.code}`))
		.all();

	const groups = db.select().from(categoryGroups).orderBy(asc(categoryGroups.code)).all();
	return { rows, groups };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const fd = await request.formData();
		const name = (fd.get('name') as string)?.trim();
		const groupId = Number(fd.get('groupId'));
		const code = (fd.get('code') as string)?.trim().toUpperCase();

		if (!name) return fail(400, { error: 'Nome obrigatório' });
		if (!groupId) return fail(400, { error: 'Grupo obrigatório' });
		if (!code) return fail(400, { error: 'Código obrigatório' });

		db.insert(categories)
			.values({ code, groupId, name, isDefault: false, isActive: true })
			.onConflictDoNothing()
			.run();
		return { success: true };
	},

	toggle: async ({ request }) => {
		const fd = await request.formData();
		const id = Number(fd.get('id'));
		const current = fd.get('isActive') === 'true';
		db.update(categories).set({ isActive: !current }).where(eq(categories.id, id)).run();
		return { success: true };
	},

	toggleGroup: async ({ request }) => {
		const fd = await request.formData();
		const groupId = Number(fd.get('groupId'));
		const activate = fd.get('activate') === 'true';
		db.update(categories).set({ isActive: activate }).where(eq(categories.groupId, groupId)).run();
		return { success: true };
	}
};
