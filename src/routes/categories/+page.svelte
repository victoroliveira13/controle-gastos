<script lang="ts">
	import { enhance } from '$app/forms';
	import { GROUP_COLORS } from '$lib/utils/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showForm = $state(false);
	let collapsed = $state<Record<number, boolean>>({});

	function isCollapsed(id: number) {
		return collapsed[id] ?? true;
	}

	const grouped = $derived(
		data.groups.map((g) => ({
			...g,
			categories: data.rows.filter((c) => c.groupId === g.id)
		}))
	);
</script>

<svelte:window />

<div class="p-8">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-slate-900">Categorias</h1>
		<button
			onclick={() => (showForm = !showForm)}
			class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			+ Nova categoria
		</button>
	</div>

	{#if showForm}
		<form
			method="POST"
			action="?/create"
			class="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-5"
			use:enhance={() => {
				return async ({ update }) => {
					showForm = false;
					await update();
				};
			}}
		>
			<div class="mb-4 text-sm font-semibold text-slate-700">Nova categoria personalizada</div>
			<div class="grid grid-cols-3 gap-4">
				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">Grupo</label>
					<select name="groupId" required class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
						<option value="">Selecione...</option>
						{#each data.groups as g}
							<option value={g.id}>{g.code} — {g.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">Código (ex: A6)</label>
					<input name="code" required placeholder="EX1" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
				</div>
				<div>
					<label class="mb-1 block text-xs font-medium text-slate-600">Nome</label>
					<input name="name" required placeholder="Minha categoria" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
				</div>
			</div>
			<div class="mt-4 flex gap-3">
				<button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Criar</button>
				<button type="button" onclick={() => (showForm = false)} class="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
			</div>
		</form>
	{/if}

	<div class="space-y-5">
		{#each grouped as group}
			{@const allInactive = group.categories.every((c) => !c.isActive)}
			<div class="rounded-xl border border-slate-100 bg-white shadow-sm">
				<div
					role="button"
					tabindex="0"
					onclick={() => (collapsed[group.id] = !isCollapsed(group.id))}
					onkeydown={(e) => e.key === 'Enter' && (collapsed[group.id] = !isCollapsed(group.id))}
					class="flex w-full items-center gap-2 rounded-t-xl border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50 cursor-pointer"
					style="border-left: 4px solid {GROUP_COLORS[group.code] ?? '#94a3b8'}"
				>
					<span class="font-semibold text-slate-800">{group.name}</span>
					<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{group.code}</span>
					{#if group.isIncome}
						<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Receita</span>
					{/if}

					<div class="ml-auto flex items-center gap-2" onclick={(e) => e.stopPropagation()}>
						<!-- Desativar / Ativar grupo -->
						<form method="POST" action="?/toggleGroup" use:enhance>
							<input type="hidden" name="groupId" value={group.id} />
							<input type="hidden" name="activate" value={allInactive ? 'true' : 'false'} />
							<button
								type="submit"
								class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors
									{allInactive
									? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
									: 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'}"
							>
								{allInactive ? 'Ativar grupo' : 'Desativar grupo'}
							</button>
						</form>

						<!-- Ícone colapso -->
						<span class="text-slate-400 text-base inline-block transition-transform {isCollapsed(group.id) ? '-rotate-90' : ''}">▾</span>
					</div>
				</div>

				{#if !isCollapsed(group.id)}
				<div class="divide-y divide-slate-50">
					{#each group.categories as cat}
						<div class="flex items-center justify-between px-5 py-2.5 {cat.isActive ? '' : 'opacity-40'}">
							<div class="flex items-center gap-3">
								<span class="w-8 text-xs font-mono font-semibold text-slate-500">{cat.code}</span>
								<span class="text-sm text-slate-800">{cat.name}</span>
								{#if !cat.isDefault}
									<span class="rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-600">custom</span>
								{/if}
							</div>
							<form method="POST" action="?/toggle" use:enhance>
								<input type="hidden" name="id" value={cat.id} />
								<input type="hidden" name="isActive" value={cat.isActive} />
								<button type="submit" class="text-xs text-slate-400 hover:text-slate-600">
									{cat.isActive ? 'Desativar' : 'Ativar'}
								</button>
							</form>
						</div>
					{/each}
				</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
