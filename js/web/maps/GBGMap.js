class GBGMap {
    constructor() {
        /**
         * The provinces in this map.
         * @type {{string: Province}}
         */
        this.provinces = {};
    }

    /**
     * Stringifies this map to JSON. Ignores circular properties and converts sets to arrays
     * to ensure proper serialization.
     * @return {string}
     */
    stringify() {
        let cache = [];
        let res = JSON.stringify(this, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                // Duplicate reference found, discard key
                if (cache.includes(value)) return;

                // Store value in our collection
                cache.push(value);
            }

            return value instanceof Set ? Array.from(value) : value;
        });
        cache = null; // Enable garbage collection

        return res;
    }
}