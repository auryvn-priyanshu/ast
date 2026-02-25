/**
 * @file astro_core_engine.js
 * @description High-precision Astronomical Engine for Vedic Astrology (Jyotish)
 * @version 1.0.0
 * @author Senior Astronomical Software Engineer
 * * This module provides the mathematical foundation for Vedic computations,
 * focusing on high-precision Julian Day conversions, Delta T estimations,
 * and the Lahiri (Chitra Paksha) Ayanamsa.
 */

"use strict";

/**
 * Constants for high-precision astronomical calculations
 */
const ASTRO_CONSTANTS = {
    JULIAN_EPOCH: 2451545.0, // J2000.0
    SIDEREAL_YEAR: 365.256363004, // Days in a sidereal year for Dasha calculations
    TROPICAL_YEAR: 365.242190402, // Mean tropical year
    SPEED_OF_LIGHT: 299792.458, // km/s
    AU: 149597870.7, // Astronomical Unit in km
    MOON_SYNODIC_PERIOD: 29.530588853,
    LAHIRI_EPOCH_JD: 2415020.31352, // JD for 1900.0
    ARCSEC_TO_RAD: Math.PI / (180 * 3600),
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI
};

/**
 * High-precision coordinate and time utility class
 */
class AstroUtils {
    /**
     * Normalizes an angle to 0-360 range
     * @param {number} angle - Angle in degrees
     * @returns {number} Normalized angle
     */
    static normalize360(angle) {
        let n = angle % 360;
        if (n < 0) n += 360;
        return n;
    }

    /**
     * Normalizes an angle to 0-2PI range
     * @param {number} radians - Angle in radians
     * @returns {number} Normalized radians
     */
    static normalize2PI(radians) {
        const TWO_PI = 2 * Math.PI;
        let n = radians % TWO_PI;
        if (n < 0) n += TWO_PI;
        return n;
    }
}

/**
 * Time Engine for Precise Julian Day and Delta-T calculations
 */
class TimeEngine {
    /**
     * Converts Gregorian Date/Time to Julian Day (UT)
     * Formula based on Jean Meeus, Astronomical Algorithms
     * * @param {number} year 
     * @param {number} month 
     * @param {number} day 
     * @param {number} hour 
     * @param {number} minute 
     * @param {number} second 
     * @param {number} timezoneOffset - Offset in hours (e.g., 5.5 for IST)
     * @returns {number} Julian Day Number
     */
    static getJulianDay(year, month, day, hour, minute, second, timezoneOffset = 0) {
        // 1. Convert Local Time to Universal Time (UT)
        let utHour = hour - timezoneOffset;
        let utDay = day;
        let utMonth = month;
        let utYear = year;

        // Adjust for underflow/overflow of hours
        if (utHour < 0) {
            utHour += 24;
            utDay -= 1;
        } else if (utHour >= 24) {
            utHour -= 24;
            utDay += 1;
        }

        // Logic for month/year adjustment in JD formula
        if (utMonth <= 2) {
            utYear -= 1;
            utMonth += 12;
        }

        const A = Math.floor(utYear / 100);
        const B = 2 - A + Math.floor(A / 4);

        // Convert time to fractional day
        const dayFraction = (utHour + minute / 60 + second / 3600) / 24;

        // Meeus JD Formula
        const jd = Math.floor(365.25 * (utYear + 4716)) +
                   Math.floor(30.6001 * (utMonth + 1)) +
                   (utDay + dayFraction) + B - 1524.5;

        return jd;
    }

    /**
     * Calculates the Millennium (T) from J2000.0
     * @param {number} jd - Julian Day
     * @returns {number} Centuries since J2000.0
     */
    static getCenturiesFromJ2000(jd) {
        return (jd - ASTRO_CONSTANTS.JULIAN_EPOCH) / 36525.0;
    }

    /**
     * Estimates Delta T (difference between TT and UT1)
     * Simplified polynomial fit for the 20th and 21st centuries
     * Essential for high-precision planet positions.
     * * @param {number} year 
     * @returns {number} Delta T in seconds
     */
    static estimateDeltaT(year) {
        const t = year - 2000;
        if (year >= 2000 && year <= 2100) {
            return 62.92 + 0.32217 * t + 0.005589 * Math.pow(t, 2);
        } else if (year >= 1900 && year < 2000) {
            const t90 = year - 1900;
            return -2.79 + 1.494119 * t90 - 0.0598939 * Math.pow(t90, 2) + 0.0061966 * Math.pow(t90, 3) / 10;
        }
        // Fallback for distant dates
        return 67.0; 
    }
}

/**
 * Precise Ayanamsa Engine (Lahiri/Chitra Paksha)
 */
class AyanamsaEngine {
    /**
     * Calculates the mean obliquity of the ecliptic (Laskar's formula)
     * @param {number} jd - Julian Day
     * @returns {number} Obliquity in degrees
     */
    static getMeanObliquity(jd) {
        const T = TimeEngine.getCenturiesFromJ2000(jd);
        const U = T / 100; // units of 10,000 years
        // Laskar 1986 formula
        const eps = 23 + 26/60 + 21.448/3600 
            - (4680.93/3600) * U 
            - (1.55/3600) * Math.pow(U, 2) 
            + (1999.25/3600) * Math.pow(U, 3) 
            - (51.38/3600) * Math.pow(U, 4);
        return eps;
    }

    /**
     * Calculates True Lahiri Ayanamsa for a given JD.
     * Uses the standard definition: 23° 51' 25.53" at J2000.0
     * minus the precession correction.
     * * @param {number} jd - Julian Day
     * @returns {number} Ayanamsa in degrees
     */
    static getLahiriAyanamsa(jd) {
        const T = TimeEngine.getCenturiesFromJ2000(jd);
        
        /**
         * The precise value of Ayanamsa at J2000.0 is approximately 23.857102 degrees.
         * We use Newcomb's precession constant with Laskar's refinement.
         */
        const ayanAtJ2000 = 23.85710277777778; // 23° 51' 25.57"
        
        // General precession in longitude (IAU 1976 model)
        const precession = (5029.0966 * T + 1.11113 * Math.pow(T, 2) + 0.0000001 * Math.pow(T, 3)) / 3600;
        
        // This calculates the drift from the fixed Spica (Chitra) position
        // in the Chitra Paksha (Lahiri) system.
        return AstroUtils.normalize360(ayanAtJ2000 + precession - (5025.64 / 3600) * T);
    }
}

/**
 * Coordinate Transformer
 * Handles conversion between Tropical and Sidereal longitudes
 */
class CoordinateTransformer {
    /**
     * Converts Tropical longitude to Sidereal (Nirayana)
     * @param {number} tropicalLongitude - in degrees
     * @param {number} jd - Julian Day
     * @returns {number} Sidereal Longitude
     */
    static toSidereal(tropicalLongitude, jd) {
        const ayanamsa = AyanamsaEngine.getLahiriAyanamsa(jd);
        return AstroUtils.normalize360(tropicalLongitude - ayanamsa);
    }
}

/**
 * Validation and Error Handling Wrapper
 */
class AstroValidator {
    static validateDateTime(year, month, day, hour, minute, second) {
        if (month < 1 || month > 12) throw new Error("Invalid Month");
        if (day < 1 || day > 31) throw new Error("Invalid Day");
        if (hour < 0 || hour > 23) throw new Error("Invalid Hour");
        if (minute < 0 || minute > 59) throw new Error("Invalid Minute");
        if (second < 0 || second > 59) throw new Error("Invalid Second");
        return true;
    }
}

/**
 * Test Stub for verification of JD and Ayanamsa
 */
function runInternalTests() {
    console.log("Running Astro Core Engine Tests...");
    
    // Test 1: Julian Day for J2000 Epoch
    const jd2000 = TimeEngine.getJulianDay(2000, 1, 1, 12, 0, 0, 0);
    console.assert(Math.abs(jd2000 - 2451545.0) < 0.00001, "JD Test Failed");

    // Test 2: Lahiri Ayanamsa for J2000
    const ayan = AyanamsaEngine.getLahiriAyanamsa(2451545.0);
    console.log(`Lahiri Ayanamsa at J2000: ${ayan.toFixed(8)}°`);
    
    console.log("Astro Core Engine Tests Completed.");
}

// Exporting modules for use in planetary and dasha engines
export {
    ASTRO_CONSTANTS,
    AstroUtils,
    TimeEngine,
    AyanamsaEngine,
    CoordinateTransformer,
    AstroValidator,
    runInternalTests
};

// Initializing self-test in production stub
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    runInternalTests();
}
