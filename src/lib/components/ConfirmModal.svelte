<script lang="ts">
	interface Props {
		open: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open,
		title = 'Confirmar',
		message,
		confirmLabel = 'Confirmar',
		cancelLabel = 'Cancelar',
		onConfirm,
		onCancel
	}: Props = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (open) dialog?.showModal();
		else dialog?.close();
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	class="w-full max-w-sm rounded-xl bg-white p-0 shadow-2xl backdrop:bg-black/40"
	onclose={onCancel}
>
	<div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
		<h2 class="text-base font-semibold text-slate-900">{title}</h2>
		<button type="button" onclick={onCancel} class="text-slate-400 hover:text-slate-600">✕</button>
	</div>

	<div class="px-6 py-5">
		<p class="text-sm text-slate-600">{message}</p>
	</div>

	<div class="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
		<button
			type="button"
			onclick={onCancel}
			class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
		>
			{cancelLabel}
		</button>
		<button
			type="button"
			onclick={onConfirm}
			class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			{confirmLabel}
		</button>
	</div>
</dialog>
