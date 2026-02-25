/**
 * @file lunar_ephemeris_engine.js
 * @description High-precision Lunar Theory Implementation for Vimshottari Dasha
 * @version 1.0.0
 * @author Senior Astronomical Software Engineer
 * * This module implements a high-precision truncated ELP-2000/82 lunar theory.
 * It calculates the geocentric longitude of the Moon with periodic perturbations,
 * fundamental arguments, and handles the transition from Tropical to Sidereal 
 * longitude using the Lahiri Ayanamsa from the Astro Core Engine.
 */

import { 
    ASTRO_CONSTANTS, 
    AstroUtils, 
    TimeEngine, 
    AyanamsaEngine, 
    CoordinateTransformer 
} from './astro_core_engine.js';

/**
 * Fundamental Arguments for the Lunar Theory (Meeus/ELP2000)
 */
class LunarFundamentalArguments {
    /**
     * @param {number} T - Centuries from J2000.0
     */
    constructor(T) {
        this.T = T;
        const T2 = T * T;
        const T3 = T2 * T;
        const T4 = T3 * T;

        // L': Mean longitude of the Moon
        this.L_prime = AstroUtils.normalize360(
            218.3164477 + 481267.8812307 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000
        );

        // D: Mean elongation of the Moon
        this.D = AstroUtils.normalize360(
            297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000
        );

        // M: Mean anomaly of the Sun
        this.M = AstroUtils.normalize360(
            357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000
        );

        // M': Mean anomaly of the Moon
        this.M_prime = AstroUtils.normalize360(
            134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000
        );

        // F: Moon's argument of latitude
        this.F = AstroUtils.normalize360(
            93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000
        );
    }
}

/**
 * Lunar Ephemeris Computation Engine
 */
class LunarEngine {
    /**
     * Calculates the geocentric longitude of the Moon (Tropical)
     * using the main periodic terms for high precision.
     * @param {number} jd - Julian Day
     * @returns {number} Tropical Longitude in degrees
     */
    static getTropicalLongitude(jd) {
        const T = TimeEngine.getCenturiesFromJ2000(jd);
        const args = new LunarFundamentalArguments(T);
        
        // Convert arguments to radians for trig functions
        const D = args.D * ASTRO_CONSTANTS.DEG_TO_RAD;
        const M = args.M * ASTRO_CONSTANTS.DEG_TO_RAD;
        const Mp = args.M_prime * ASTRO_CONSTANTS.DEG_TO_RAD;
        const F = args.F * ASTRO_CONSTANTS.DEG_TO_RAD;

        /**
         * Periodic terms for Longitude (Coefficients in 0.000001 degrees)
         * Data based on Chapront ELP-2000/82
         */
        let sumLongitude = 0;

        // Major perturbations
        sumLongitude += 6288774 * Math.sin(Mp);
        sumLongitude += 1274027 * Math.sin(2 * D - Mp);
        sumLongitude += 658314 * Math.sin(2 * D);
        sumLongitude += 213618 * Math.sin(2 * Mp);
        sumLongitude += -185116 * Math.sin(M);
        sumLongitude += -114332 * Math.sin(2 * F);
        sumLongitude += 58793 * Math.sin(2 * D - 2 * Mp);
        sumLongitude += 57066 * Math.sin(2 * D - M - Mp);
        sumLongitude += 53322 * Math.sin(2 * D + Mp);
        sumLongitude += 45758 * Math.sin(2 * D - M);
        sumLongitude += -40923 * Math.sin(M - Mp);
        sumLongitude += -34720 * Math.sin(D);
        sumLongitude += -30383 * Math.sin(M + Mp);
        sumLongitude += 15327 * Math.sin(2 * D - 2 * F);
        sumLongitude += -12528 * Math.sin(Mp + 2 * F);
        sumLongitude += -10980 * Math.sin(Mp - 2 * F);
        sumLongitude += 10675 * Math.sin(4 * D - Mp);
        sumLongitude += 10034 * Math.sin(3 * Mp);
        sumLongitude += 8548 * Math.sin(4 * D - 2 * Mp);
        sumLongitude += -7888 * Math.sin(2 * D + M - Mp);
        sumLongitude += -6766 * Math.sin(2 * D + M);
        sumLongitude += -5163 * Math.sin(D - Mp);

        // Venus and Jupiter perturbations (Truncated for Dasha precision)
        const V = (157.71 + 311013.1 * T) * ASTRO_CONSTANTS.DEG_TO_RAD;
        const J = (34.35 + 3034.9 * T) * ASTRO_CONSTANTS.DEG_TO_RAD;
        sumLongitude += 3958 * Math.sin(args.L_prime * ASTRO_CONSTANTS.DEG_TO_RAD - V);
        sumLongitude += 1962 * Math.sin(args.L_prime * ASTRO_CONSTANTS.DEG_TO_RAD - J);

        // Convert 0.000001 deg units to degrees and add to mean longitude
        const longitude = args.L_prime + (sumLongitude / 1000000.0);

        return AstroUtils.normalize360(longitude);
    }

    /**
     * Calculates the Sidereal (Nirayana) longitude of the Moon
     * @param {number} jd - Julian Day
     * @returns {number} Sidereal Longitude in degrees
     */
    static getSiderealLongitude(jd) {
        const tropicalLong = this.getTropicalLongitude(jd);
        return CoordinateTransformer.toSidereal(tropicalLong, jd);
    }
}

/**
 * Nakshatra and Dasha Context Engine
 */
class NakshatraEngine {
    /**
     * Nakshatra data including Lord and Dasha Years
     * Order: Ashwini to Revati
     */
    static get NAKSHATRA_DATA() {
        return [
            { id: 1, name: "Ashwini", lord: "Ketu", years: 7 },
            { id: 2, name: "Bharani", lord: "Venus", years: 20 },
            { id: 3, name: "Krittika", lord: "Sun", years: 6 },
            { id: 4, name: "Rohini", lord: "Moon", years: 10 },
            { id: 5, name: "Mrigashira", lord: "Mars", years: 7 },
            { id: 6, name: "Ardra", lord: "Rahu", years: 18 },
            { id: 7, name: "Punarvasu", lord: "Jupiter", years: 16 },
            { id: 8, name: "Pushya", lord: "Saturn", years: 19 },
            { id: 9, name: "Ashlesha", lord: "Mercury", years: 17 },
            { id: 10, name: "Magha", lord: "Ketu", years: 7 },
            { id: 11, name: "Purva Phalguni", lord: "Venus", years: 20 },
            { id: 12, name: "Uttara Phalguni", lord: "Sun", years: 6 },
            { id: 13, name: "Hasta", lord: "Moon", years: 10 },
            { id: 14, name: "Chitra", lord: "Mars", years: 7 },
            { id: 15, name: "Swati", lord: "Rahu", years: 18 },
            { id: 16, name: "Vishakha", lord: "Jupiter", years: 16 },
            { id: 17, name: "Anuradha", lord: "Saturn", years: 19 },
            { id: 18, name: "Jyeshtha", lord: "Mercury", years: 17 },
            { id: 19, name: "Mula", lord: "Ketu", years: 7 },
            { id: 20, name: "Purva Ashadha", lord: "Venus", years: 20 },
            { id: 21, name: "Uttara Ashadha", lord: "Sun", years: 6 },
            { id: 22, name: "Shravana", lord: "Moon", years: 10 },
            { id: 23, name: "Dhanishta", lord: "Mars", years: 7 },
            { id: 24, name: "Shatabhisha", lord: "Rahu", years: 18 },
            { id: 25, name: "Purva Bhadrapada", lord: "Jupiter", years: 16 },
            { id: 26, name: "Uttara Bhadrapada", lord: "Saturn", years: 19 },
            { id: 27, name: "Revati", lord: "Mercury", years: 17 }
        ];
    }

    /**
     * Determines Nakshatra details from Sidereal Moon Longitude
     * @param {number} siderealLongitude - in degrees
     * @returns {Object} Nakshatra metadata
     */
    static getNakshatraInfo(siderealLongitude) {
        const normalizedLong = AstroUtils.normalize360(siderealLongitude);
        const arcPerNakshatra = 360 / 27; // 13.3333333 degrees
        
        const nakshatraIndex = Math.floor(normalizedLong / arcPerNakshatra);
        const nakshatra = this.NAKSHATRA_DATA[nakshatraIndex];
        
        const elapsedInNakshatra = normalizedLong % arcPerNakshatra;
        const percentageElapsed = elapsedInNakshatra / arcPerNakshatra;
        
        // Pada calculation (Each Nakshatra has 4 Padas)
        const pada = Math.floor((elapsedInNakshatra / arcPerNakshatra) * 4) + 1;

        return {
            index: nakshatraIndex,
            name: nakshatra.name,
            lord: nakshatra.lord,
            totalYears: nakshatra.years,
            elapsedPercentage: percentageElapsed,
            remainingPercentage: 1 - percentageElapsed,
            pada: pada
        };
    }
}

/**
 * Validation and Test Stub
 */
class LunarValidator {
    static runTests() {
        console.log("Running Lunar Ephemeris Tests...");
        // Test: Approximate Moon position for a known date
        // Jan 1, 2000, 12:00 UTC
        const jd = 2451545.0;
        const moonLong = LunarEngine.getSiderealLongitude(jd);
        const nInfo = NakshatraEngine.getNakshatraInfo(moonLong);
        
        console.log(`Sidereal Moon Longitude (J2000): ${moonLong.toFixed(6)}°`);
        console.log(`Nakshatra: ${nInfo.name}, Pada: ${nInfo.pada}, Lord: ${nInfo.lord}`);
        console.log("Lunar Ephemeris Tests Completed.");
    }
}

export {
    LunarFundamentalArguments,
    LunarEngine,
    NakshatraEngine,
    LunarValidator
};

// Initializing self-test in production stub
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    LunarValidator.runTests();
}
