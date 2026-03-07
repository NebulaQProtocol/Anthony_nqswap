'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';
import { usePoolCandles, useSelectedPool } from '@/store/pool-store';
import { formatPrice } from '@/lib/utils';

/**
 * CandlestickChart: Lightweight Charts wrapper with imperative updates.
 * Bypasses React's render cycle — calls series.update() directly in useEffect.
 * This is critical for 60fps performance.
 */
export function CandlestickChart() {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    const selectedPool = useSelectedPool();
    const candles = usePoolCandles(selectedPool?.pool.id ?? '');

    // Initialize chart (once)
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#12131a' },
                textColor: '#8b8d9e',
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
            },
            grid: {
                vertLines: { color: '#1e1f2b' },
                horzLines: { color: '#1e1f2b' },
            },
            crosshair: {
                mode: 0, // Normal
                vertLine: {
                    color: '#3b82f6',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#3b82f6',
                },
                horzLine: {
                    color: '#3b82f6',
                    width: 1,
                    style: 2,
                    labelBackgroundColor: '#3b82f6',
                },
            },
            rightPriceScale: {
                borderColor: '#2a2b38',
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            timeScale: {
                borderColor: '#2a2b38',
                timeVisible: true,
                secondsVisible: true,
            },
            handleScroll: { vertTouchDrag: false },
        });

        const series = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        chartRef.current = chart;
        seriesRef.current = series;

        // Handle resize
        const resizeObserver = new ResizeObserver((entries) => {
            const { width, height } = entries[0].contentRect;
            chart.applyOptions({ width, height });
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    // Update chart data imperatively (bypasses React render)
    useEffect(() => {
        if (!seriesRef.current || candles.length === 0) return;

        // Convert candles to Lightweight Charts format
        const chartData: CandlestickData<Time>[] = candles.map((c) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        seriesRef.current.setData(chartData);

        // Auto-scroll to latest
        if (chartRef.current) {
            chartRef.current.timeScale().scrollToRealTime();
        }
    }, [candles]);

    const displayPrice = selectedPool?.priceState.confirmedPrice ?? selectedPool?.priceState.pendingPrice;
    const pendingPrice = selectedPool?.priceState.pendingPrice;
    const status = selectedPool?.priceState.status ?? 'stale';

    return (
        <div className="chart-panel" id="chart-panel">
            <div className="chart-header">
                <div>
                    <div className="pool-name">{selectedPool?.pool.name ?? 'Select a pool'}</div>
                </div>
                <div className="price-display">
                    {displayPrice && (
                        <div>
                            <div className="price-label">Confirmed</div>
                            <div className="price-confirmed">
                                ${selectedPool?.priceState.confirmedPrice
                                    ? formatPrice(selectedPool.priceState.confirmedPrice)
                                    : '—'}
                            </div>
                        </div>
                    )}
                    {pendingPrice && status === 'pending' && (
                        <div>
                            <div className="price-label">Pending</div>
                            <div className="price-pending">
                                ${formatPrice(pendingPrice)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="chart-container" ref={chartContainerRef} id="candlestick-chart" />
        </div>
    );
}
