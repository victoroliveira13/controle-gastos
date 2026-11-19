<script lang="ts">
	import { onMount } from 'svelte';
	import type * as echarts from 'echarts';

	interface ZoomRange {
		start: number;
		end: number;
		startValue?: number;
		endValue?: number;
	}

	interface Props {
		option: echarts.EChartsOption;
		height?: string;
		onzoom?: (range: ZoomRange) => void;
	}

	let { option, height = '300px', onzoom }: Props = $props();

	let container: HTMLDivElement;
	let chart: echarts.ECharts | undefined;

	// onMount async não executa o cleanup retornado: inicializa aqui e descarta ao desmontar
	onMount(() => {
		let disposed = false;
		let ro: ResizeObserver | undefined;
		import('echarts').then((ec) => {
			if (disposed) return;
			chart = ec.init(container, null, { renderer: 'canvas' });
			chart.setOption(option);
			chart.on('datazoom', (e) => {
				const range = (e as unknown as { batch?: ZoomRange[] }).batch?.[0];
				if (range) onzoom?.(range);
			});
			ro = new ResizeObserver(() => chart?.resize());
			ro.observe(container);
		});

		return () => {
			disposed = true;
			ro?.disconnect();
			chart?.dispose();
		};
	});

	$effect(() => {
		option;
		if (chart) chart.setOption(option, { notMerge: true });
	});
</script>

<div bind:this={container} style:height class="w-full"></div>
