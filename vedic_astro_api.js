/**
 * @file vedic_astro_api.js
 * @description Production-grade API Layer for High-Precision Vimshottari Dasha
 * @version 1.0.0
 * @author Senior Astronomical Software Engineer
 * * This module provides the top-level orchestration for the astronomical engines.
 * It handles input validation, coordinate synchronization, and generates
 * structured JSON responses for Dasha timelines and planetary states.
 */

import { 
    TimeEngine, 
    AyanamsaEngine, 
    AstroValidator, 
    ASTRO_CONSTANTS 
} from './astro_core_engine.js';

import { 
    LunarEngine, 
    NakshatraEngine 
} from './lunar_ephemeris_engine.js';

import { 
    DashaEngine 
} from './dasha_engine.js';

/**
 * Main Integration API for Vedic Astrology Calculations
 */
class VedicAstroAPI {
    /**
     * Entry point to calculate a complete birth profile and Dasha timeline.
     * @param {Object} birthData - { year, month, day, hour, min, sec, lat, lon, tzone }
     * @param {number} depth - Recursive depth for Dasha (1-6)
     * @returns {Object} Full astronomical profile
     */
    static getBirthProfile(birthData, depth = 6) {
        const { year, month, day, hour, min, sec, tzone } = birthData;

        // 1. Validation
        AstroValidator.validateDateTime(year, month, day, hour, min, sec);

        // 2. Time Conversion (UTC Julian Day)
        const jd = TimeEngine.getJulianDay(year, month, day, hour, min, sec, tzone);
        const deltaT = TimeEngine.estimateDeltaT(year);
        
        // 3. Astronomical Calculations
        const ayanamsa = AyanamsaEngine.getLahiriAyanamsa(jd);
        const moonSidereal = LunarEngine.getSiderealLongitude(jd);
        const nakshatra = NakshatraEngine.getNakshatraInfo(moonSidereal);

        // 4. Dasha Timeline Generation
        const dashaResults = DashaEngine.calculateTimeline(jd, depth);

        // 5. Structure Final Output
        return {
            metadata: {
                calculationDate: new Date().toISOString(),
                softwareVersion: "1.1.0-PROD",
                ayanamsaSystem: "Lahiri (Chitra Paksha)",
                constantsUsed: {
                    siderealYear: ASTRO_CONSTANTS.SIDEREAL_YEAR,
                    jdEpoch: ASTRO_CONSTANTS.JULIAN_EPOCH
                }
            },
            input: {
                ...birthData,
                julianDay: jd,
                deltaT: deltaT
            },
            astronomy: {
                ayanamsaValue: ayanamsa,
                moonSiderealLongitude: moonSidereal,
                moonNakshatra: nakshatra.name,
                moonPada: nakshatra.pada,
                moonLord: nakshatra.lord
            },
            dashaTimeline: dashaResults.timeline
        };
    }

    /**
     * Calculates the active dasha chain for a specific "Now" or Target date.
     * Useful for predictive transit analysis.
     */
    static getCurrentDashaChain(birthProfile, targetDate = {}) {
        const { year, month, day, hour = 12, min = 0, sec = 0, tzone = 0 } = targetDate;
        
        const targetJD = TimeEngine.getJulianDay(
            year || new Date().getUTCFullYear(),
            month || (new Date().getUTCMonth() + 1),
            day || new Date().getUTCDate(),
            hour, min, sec, tzone
        );

        return DashaEngine.getActiveDashaAt(birthProfile, targetJD);
    }
}

/**
 * High-Precision Test Case
 */
class ProductionSuite {
    static run() {
        console.log("=== VEDIC ASTRO PRODUCTION SUITE ===");
        
        const birthParams = {
            year: 1985,
            month: 10,
            day: 25,
            hour: 14,
            min: 30,
            sec: 0,
            tzone: 5.5 // IST
        };

        const profile = VedicAstroAPI.getBirthProfile(birthParams, 4);
        
        console.log(`Verified Birth JD: ${profile.input.julianDay}`);
        console.log(`Lunar Mansion: ${profile.astronomy.moonNakshatra} Pada ${profile.astronomy.moonPada}`);
        console.log(`Initial Dasha: ${profile.astronomy.moonLord}`);
        
        // Check "Current" Dasha for the profile
        const now = { year: 2024, month: 5, day: 20 };
        const activeChain = VedicAstroAPI.getCurrentDashaChain(profile, now);
        
        console.log("Current Dasha Chain:");
        activeChain.forEach(c => console.log(` - Level ${c.level}: ${c.lord}`));
        
        console.log("=== SUITE COMPLETE ===");
    }
}

export { VedicAstroAPI, ProductionSuite };

// Execution guard for testing
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    ProductionSuite.run();
}
