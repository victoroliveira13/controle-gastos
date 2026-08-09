<script lang="ts">
	import { onMount } from 'svelte';
	import type * as echarts from 'echarts';

	interface Props {
		option: echarts.EChartsOption;
		height?: string;
	}

	let { option, height = '300px' }: Props = $props();

	let container: HTMLDivElement;
	let chart: echarts.ECharts;

	onMount(async () => {
		const ec = await import('echarts');
		chart = ec.init(container, null, { renderer: 'canvas' });
		chart.setOption(option);

		const ro = new ResizeObserver(() => chart.resize());
		ro.observe(container);

		return () => {
			ro.disconnect();
			chart.dispose();
		};
	});

	$effect(() => {
		option;
		if (chart) chart.setOption(option, { notMerge: true });
	});
</script>

<div bind:this={container} style:height class="w-full"></div>
