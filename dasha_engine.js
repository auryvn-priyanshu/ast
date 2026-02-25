/**
 * @file dasha_engine.js
 * @description Recursive Multi-level Vimshottari Dasha Calculation Engine
 * @version 1.1.0
 * @author Senior Astronomical Software Engineer
 * * This module calculates the hierarchical timeline of Vimshottari Dashas.
 * It uses the sidereal year (365.256363 days) for duration mapping and
 * recursive logic to generate:
 * 1. Mahadasha (MD)
 * 2. Antardasha (AD)
 * 3. Pratyantardasha (PD)
 * 4. Sukshma Dasha (SD)
 * 5. Prana Dasha (PrD)
 * 6. Deha Dasha (DD)
 */

import { ASTRO_CONSTANTS, TimeEngine } from './astro_core_engine.js';
import { NakshatraEngine, LunarEngine } from './lunar_ephemeris_engine.js';

/**
 * Planetary Sequence and Cycles for Vimshottari Dasha
 * Fixed 120-year cycle definition.
 */
const DASHA_SEQUENCE = [
    { lord: "Ketu", years: 7 },
    { lord: "Venus", years: 20 },
    { lord: "Sun", years: 6 },
    { lord: "Moon", years: 10 },
    { lord: "Mars", years: 7 },
    { lord: "Rahu", years: 18 },
    { lord: "Jupiter", years: 16 },
    { lord: "Saturn", years: 19 },
    { lord: "Mercury", years: 17 }
];

/**
 * Core Dasha Calculation Engine
 */
class DashaEngine {
    /**
     * Calculates the full Dasha timeline based on birth data
     * @param {number} jd - Birth Julian Day (UT)
     * @param {number} maxLevels - Depth of calculation (Default 6 for production)
     * @returns {Object} Full hierarchical Dasha tree
     */
    static calculateTimeline(jd, maxLevels = 6) {
        // 1. Get Lunar position and Nakshatra info
        const moonSiderealLong = LunarEngine.getSiderealLongitude(jd);
        const nakshatraInfo = NakshatraEngine.getNakshatraInfo(moonSiderealLong);
        
        // 2. Locate starting point in the sequence based on Janma Nakshatra Lord
        const startIndex = DASHA_SEQUENCE.findIndex(d => d.lord === nakshatraInfo.lord);
        
        // 3. Calculate Dasha Balance (Remaining time in the first Mahadasha)
        // Duration in days = Total Years * Sidereal Year Constant
        const totalFirstMDDays = nakshatraInfo.totalYears * ASTRO_CONSTANTS.SIDEREAL_YEAR;
        const remainingMDDays = totalFirstMDDays * nakshatraInfo.remainingPercentage;
        
        // The first Mahadasha ends at: birthJD + remainingMDDays
        let currentEndJD = jd + remainingMDDays;
        let currentStartJD = currentEndJD - totalFirstMDDays;

        const timeline = [];

        // 4. Generate 120-year cycle (9 Mahadashas) starting from the birth lord
        for (let i = 0; i < 9; i++) {
            const sequenceIndex = (startIndex + i) % 9;
            const planet = DASHA_SEQUENCE[sequenceIndex];
            const durationDays = planet.years * ASTRO_CONSTANTS.SIDEREAL_YEAR;
            
            // Adjust the very first Dasha to reflect birth balance
            const effectiveStart = (i === 0) ? jd : currentStartJD;
            const effectiveEnd = (i === 0) ? currentEndJD : currentStartJD + durationDays;

            const dashaNode = {
                level: 1,
                lord: planet.lord,
                startJD: effectiveStart,
                endJD: effectiveEnd,
                durationDays: effectiveEnd - effectiveStart,
                subDashas: []
            };

            // Recursive call for sub-levels (Antardasha and below)
            if (maxLevels > 1) {
                dashaNode.subDashas = this.calculateSubDashas(
                    dashaNode.startJD, 
                    dashaNode.endJD, 
                    2, 
                    maxLevels, 
                    sequenceIndex
                );
            }

            timeline.push(dashaNode);
            
            // Increment reference for next Mahadasha in the loop
            currentStartJD = effectiveEnd;
        }

        return {
            birthJD: jd,
            nakshatra: nakshatraInfo,
            timeline: timeline
        };
    }

    /**
     * Recursively calculates sub-dashas (Antar, Pratyantar, Sukshma, Prana, Deha)
     * The duration of a sub-dasha is proportional: (Parent_Duration * Planet_Years) / 120
     * @param {number} parentStart - Start JD of parent dasha
     * @param {number} parentEnd - End JD of parent dasha
     * @param {number} currentLevel - Depth level
     * @param {number} maxLevels - Max depth level
     * @param {number} parentSeqIndex - Index of the parent planet in DASHA_SEQUENCE
     * @returns {Array} List of sub-dasha nodes
     */
    static calculateSubDashas(parentStart, parentEnd, currentLevel, maxLevels, parentSeqIndex) {
        const subTimeline = [];
        const parentDuration = parentEnd - parentStart;
        let currentSubStart = parentStart;

        for (let i = 0; i < 9; i++) {
            const sequenceIndex = (parentSeqIndex + i) % 9;
            const planet = DASHA_SEQUENCE[sequenceIndex];
            
            /**
             * Precision Ratio Calculation:
             * Every level of sub-dasha divides the parent period in the same 120-year ratio.
             */
            const subDuration = (parentDuration * planet.years) / 120.0;
            const currentSubEnd = currentSubStart + subDuration;

            const node = {
                level: currentLevel,
                lord: planet.lord,
                startJD: currentSubStart,
                endJD: currentSubEnd,
                durationDays: subDuration,
                subDashas: []
            };

            // Recursion for next level down
            if (currentLevel < maxLevels) {
                node.subDashas = this.calculateSubDashas(
                    node.startJD,
                    node.endJD,
                    currentLevel + 1,
                    maxLevels,
                    sequenceIndex
                );
            }

            subTimeline.push(node);
            currentSubStart = currentSubEnd;
        }

        return subTimeline;
    }

    /**
     * Finds the active Dasha periods for a specific point in time (Target JD)
     * @param {Object} results - The object returned from calculateTimeline
     * @param {number} targetJD - The JD to check
     * @returns {Array} List of active lords from Mahadasha to max level
     */
    static getActiveDashaAt(results, targetJD) {
        const activeChain = [];
        let currentSearchLayer = results.timeline;

        while (currentSearchLayer && currentSearchLayer.length > 0) {
            const activeNode = currentSearchLayer.find(node => 
                targetJD >= node.startJD && targetJD < node.endJD
            );

            if (activeNode) {
                activeChain.push({
                    level: activeNode.level,
                    lord: activeNode.lord,
                    startJD: activeNode.startJD,
                    endJD: activeNode.endJD
                });
                currentSearchLayer = activeNode.subDashas;
            } else {
                break;
            }
        }

        return activeChain;
    }

    /**
     * Utility to format duration for high-precision validation
     * @param {number} days 
     * @returns {string} Human readable duration
     */
    static formatDuration(days) {
        const d = Math.floor(days);
        const h = Math.floor((days - d) * 24);
        const m = Math.floor(((days - d) * 24 - h) * 60);
        const s = Math.round((((days - d) * 24 - h) * 60 - m) * 60);
        return `${d}d ${h}h ${m}m ${s}s`;
    }
}

/**
 * Production Test Stub for Dasha Engine
 */
class DashaValidator {
    static test() {
        console.log("Initializing Vimshottari Dasha Engine Level-6 Test...");
        
        // Example: Birth Jan 1, 1990, 05:30 IST (00:00 UTC)
        const birthJD = TimeEngine.getJulianDay(1990, 1, 1, 0, 0, 0, 0);
        
        try {
            // Calculate down to Level 6 (Deha Dasha)
            const results = DashaEngine.calculateTimeline(birthJD, 6); 
            
            console.log("Dasha Calculation Successful.");
            console.log(`Birth Nakshatra: ${results.nakshatra.name}`);
            console.log(`Starting Lord: ${results.nakshatra.lord}`);
            
            // Check current active periods (Targeting: Feb 25, 2026)
            const targetJD = TimeEngine.getJulianDay(2026, 2, 25, 12, 0, 0, 0);
            const active = DashaEngine.getActiveDashaAt(results, targetJD);
            
            console.log("Active Dasha Chain for Feb 25, 2026:");
            active.forEach(level => {
                console.log(`Level ${level.level}: ${level.lord}`);
            });

            // Precision Check: Sum of Antardashas in first MD
            const firstMD = results.timeline[0];
            const sumAD = firstMD.subDashas.reduce((acc, cur) => acc + cur.durationDays, 0);
            const diff = Math.abs(sumAD - firstMD.durationDays);
            
            console.log(`Precision drift in sub-levels: ${diff.toExponential(4)} days`);
            
        } catch (error) {
            console.error("Dasha Engine Error:", error.message);
        }
    }
}

export {
    DashaEngine,
    DashaValidator,
    DASHA_SEQUENCE
};

// Auto-run test in dev/test environments
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    DashaValidator.test();
}
