export default interface Column {
    /**
     * Returns the name of this column.
     */
    getName(): string;

    /**
     * Returns the index of this column.
     */
    getIndex(): number;

    /**
     * Returns the id of this column.
     */
    getId(): number;

    /**
     * Determines if this column is nullable.
     */
    isNullable(): boolean;

    /**
     * Returns the scale associated with this column.
     */
    getScale(): number;

    /**
     * Returns the type associated with this column.
     */
    getType(): string;

    /**
     * Returns true if this column is type STRING.
     */
    isString(): boolean;

    /**
     * Returns true if this column is type BINARY.
     */
    isBinary(): boolean;

    /**
     * Returns true if this column is type NUMBER.
     */
    isNumber(): boolean;

    /**
     * Returns true if this column is type BOOLEAN.
     */
    isBoolean(): boolean;

    /**
     * Returns true if this column is type DATE.
     */
    isDate(): boolean;

    /**
     * Returns true if this column is type TIME.
     */
    isTime(): boolean;

    /**
     * Returns true if this column is type TIMESTAMP.
     */
    isTimestamp(): boolean;

    /**
     * Returns true if this column is type TIMESTAMP_LTZ.
     */
    isTimestampLtz(): boolean;

    /**
     * Returns true if this column is type TIMESTAMP_NTZ.
     */
    isTimestampNtz(): boolean;

    /**
     * Returns true if this column is type TIMESTAMP_TZ.
     */
    isTimestampTz(): boolean;

    /**
     * Returns true if this column is type VARIANT.
     */
    isVariant(): boolean;

    /**
     * Returns true if this column is type OBJECT.
     */
    isObject(): boolean;

    /**
     * Returns true if this column is type ARRAY.
     */
    isArray(): boolean;
}
