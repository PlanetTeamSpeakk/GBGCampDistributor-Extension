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

    // Must be overridden by subclasses
    /**
     * Converts a province id to its name.
     * This is primarily possible because province names follow a pretty strict pattern.
     * Whether the names of provinces are the same every season (assuming the same map) is unknown,
     * but I am pretty certain they are as the server does not inform the client of province names.
     * @param id {number} The id to convert
     * @return {string} The name of the province associated with the given id
     */
    idToName(id) {}
}