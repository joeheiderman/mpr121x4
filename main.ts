// mpr121x4 touch blocks
//
// New Version with support for multiple mpr121 touch sensor boards
/***********************************************
 * Choose one of four addresses.
 * By default, its address is 0x5A (that is 5A in hexadecimal).
 * By linking the ADDR (or ADD) pin to one of 3.3V, SDA or SCL it is possible to change the default
 * and choose 0x5B, 0x5C or 0x5D.
 * This means a single microcontroller than support up to 48 capacitive touch inputs using these modules.
 * NOTE: By default ADDR is connected to GND. To add a second board, cut the ADDR to GND jumper.
 * WARNING: Connecting +3V to ADDR will cause a SHORT CIRCUIT if this track is not cut.
 */
/*******************************************
 * Change Log:
 * 07/26/2022 JRH001
 *  Change TouchSensor range from T5..T16 to T1..T12
 *      and reorder bit pattern from 1 to 12
 * 07/27/2022 JRH002
 *  Make touchState an array for multiple mpr121 boards
 *  Add mprAddress to TouchState template
 *  Multiple changes to include board number (0,1,2...) in the user functions
 * 07/27/2022 3pm - changes to //% block statements
 * 07/27/2022 JRH003
 *   Fix creation of touchState by initializing it
 * 07/28/2022 remove serial.writeLine from init
 * 07/28/2022 Duh... uncomment scheduler - background.schedule
 * 07/28/2022 JRH004
 *  Fix reversed parameters in isTouched function
 * 07/28/2022 R5
 *    clean up mpr121x4 headings
 * 0728/2022 R6
 *    More makecode changes. add limits of 0 to 3 to the "board"
 * 07/28/2022 R7
 *  More wording changes
 * 07/29/2022 R8
 *  Testing second mpr121 only. Added a test for undefined board.
 * 07/30/2022 Changed icon to a hand with pointing index finger
 * 07/30/2022 R11 Moved "board" to the end of the parameter list
 * 07/30/2022 R12 Change T1..T12 to T0..T11
 *    Deleted lots of commented out stuff
 * 08/01/2022 deleted MPR121 from Menu
 * 08/01/2022 reverse order of board and sensor in Menu
 * 08/02/2022 revise menu wording
 * 08/03/2022 remove mpr121x4 references
 * 08/03/2022 Added scanner started flag to fix the test if there is more than one board
 */

let scannerStarted = false;

const enum TouchSensor { // JRH001
    T0 = 0b000000000001,
    T1 = 0b000000000010,
    T2 = 0b000000000100,
    T3 = 0b000000001000,
    T4 = 0b000000010000,
    T5 = 0b000000100000,
    T6 = 0b000001000000,
    T7 = 0b000010000000,
    T8 = 0b000100000000,
    T9 = 0b001000000000,
    T10 = 0b010000000000,
    T11 = 0b100000000000,
    //% block="any"
    Any = 1 << 30,
}

const enum TouchAction {
    //% block="touched"
    Touched = 0,
    //% block="released"
    Released = 1,
}
// Changed icon to a hand with pointing index finger
// color=#0fbc11 icon="\u272a" block="MPR121 Touch Sensor"
//% color=#0fbc11 icon="\uf25a" block="MPR121 Touch Sensor"
//% category="MPR121 Touch Sensor"
// category="mpr121x4"

namespace mpr121x4 {
    const MPR121_BASE_ADDRESS = 0x5a;

    class TouchHandler {
        sensor: TouchSensor;
        handler: () => void;

        constructor(sensor: TouchSensor, handler: () => void) {
            this.sensor = sensor;
            this.handler = handler;
        }

        onEvent(sensor: TouchSensor) {
            if (sensor === this.sensor || TouchSensor.Any === this.sensor) {
                this.handler();
            }
        }
    }

    interface TouchState {
        mprAddress: number; // JRH002
        touchStatus: number;
        eventValue: number;
        hasNewTouchedEvent: boolean;
        onTouched: TouchHandler[];
        onReleased: TouchHandler[];
    }

    let touchState: TouchState[] = []; // JRH003 - initialize touchState
    /*
     * Initialize the touch controller.
     */
    //% blockId="mpr121x4_touch_init"
    //% block="initialize board | %board"
    //% weight=70

    function initTouchController(board: number): void {
        if (!!touchState[board]) {
            // return if this board is already initialized
            return;
        }

        touchState[board] = {
            mprAddress: board + MPR121_BASE_ADDRESS, // JRH002
            touchStatus: 0,
            eventValue: 0,
            hasNewTouchedEvent: false,
            onTouched: [],
            onReleased: [],
        };

        const addr = touchState[board].mprAddress;

        serial.writeLine(`initTouchController - board ${board} address ${addr}`);

        mpr121.reset(addr);

        // Stop capture
        mpr121.stop(addr);

        // Input filter for rising state
        mpr121.configure(addr, mpr121.Config.MHDR, 0x01);
        mpr121.configure(addr, mpr121.Config.NHDR, 0x01);
        mpr121.configure(addr, mpr121.Config.NCLR, 0x10);
        mpr121.configure(addr, mpr121.Config.FDLR, 0x20);

        // Input filter for falling state
        mpr121.configure(addr, mpr121.Config.MHDF, 0x01);
        mpr121.configure(addr, mpr121.Config.NHDF, 0x01);
        mpr121.configure(addr, mpr121.Config.NCLF, 0x10);
        mpr121.configure(addr, mpr121.Config.FDLF, 0x20);

        // Input filter for touched state
        mpr121.configure(addr, mpr121.Config.NHDT, 0x01);
        mpr121.configure(addr, mpr121.Config.NCLT, 0x10);
        mpr121.configure(addr, mpr121.Config.FDLT, 0xff);

        // Unused proximity sensor filter
        mpr121.configure(addr, mpr121.Config.MHDPROXR, 0x0f);
        mpr121.configure(addr, mpr121.Config.NHDPROXR, 0x0f);
        mpr121.configure(addr, mpr121.Config.NCLPROXR, 0x00);
        mpr121.configure(addr, mpr121.Config.FDLPROXR, 0x00);
        mpr121.configure(addr, mpr121.Config.MHDPROXF, 0x01);
        mpr121.configure(addr, mpr121.Config.NHDPROXF, 0x01);
        mpr121.configure(addr, mpr121.Config.NCLPROXF, 0xff);
        mpr121.configure(addr, mpr121.Config.FDLPROXF, 0xff);
        mpr121.configure(addr, mpr121.Config.NHDPROXT, 0x00);
        mpr121.configure(addr, mpr121.Config.NCLPROXT, 0x00);
        mpr121.configure(addr, mpr121.Config.FDLPROXT, 0x00);

        // Debounce configuration (used primarily for interrupts)
        mpr121.configure(addr, mpr121.Config.DTR, 0x11);

        // Electrode clock frequency etc
        mpr121.configure(addr, mpr121.Config.AFE1, 0xff);
        mpr121.configure(addr, mpr121.Config.AFE2, 0x30);

        // Enable autoconfiguration / calibration
        mpr121.configure(addr, mpr121.Config.AUTO_CONFIG_0, 0x00);
        mpr121.configure(addr, mpr121.Config.AUTO_CONFIG_1, 0x00);

        // Tuning parameters for the autocalibration algorithm
        mpr121.configure(addr, mpr121.Config.AUTO_CONFIG_USL, 0x00);
        mpr121.configure(addr, mpr121.Config.AUTO_CONFIG_LSL, 0x00);
        mpr121.configure(addr, mpr121.Config.AUTO_CONFIG_TL, 0x00);

        // Default sensitivity thresholds
        mpr121.configureThresholds(addr, 60, 20);

        // Restart capture and stop repeated writing
        mpr121.start(addr);

        /*********************************************************************
         * MPR121 Scanner
         *****************************************************************/
        if (scannerStarted) return; // start just one scanner
        scannerStarted = true;
        
        serial.writeLine("Starting mpr121 scanner...");

        basic.forever(function () {
            for (let board = 0; board < touchState.length; board++) {
                if (!touchState[board]) continue; // R8 skip this undefined board

                const touchStatus = mpr121.readTouchStatus(
                    touchState[board].mprAddress
                ); // JRH002

                if (touchStatus != touchState[board].touchStatus) {
                    const previousState = touchState[board].touchStatus; // JRH002
                    touchState[board].touchStatus = touchStatus; // JRH002

                    for (
                        let touchSensorBit = 1;
                        touchSensorBit <= 2048;
                        touchSensorBit <<= 1
                    ) {
                        // Raise event when touch ends
                        if ((touchSensorBit & touchStatus) === 0) {
                            if (!((touchSensorBit & previousState) === 0)) {
                                touchState[board].eventValue = touchSensorBit; // JRH002
                                // call onEvent forEach TouchHandler in the onReleased array
                                //    if this sensor is found in the array of TouchHandlers
                                //      run the associated function block
                                touchState[board].onReleased.forEach((th) => {
                                    th.onEvent(touchSensorBit);
                                }); // JRH002
                            }
                        }

                        // Raise event when touch starts
                        if ((touchSensorBit & touchStatus) !== 0) {
                            if (!((touchSensorBit & previousState) !== 0)) {
                                touchState[board].eventValue = touchSensorBit; // JRH002
                                touchState[board].hasNewTouchedEvent = true; // JRH002
                                // See comment above for a description of how the next statement works
                                touchState[board].onTouched.forEach((th) => {
                                    th.onEvent(touchSensorBit);
                                }); //JRH002
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Do something when a touch sensor is touched or released.
     * @param sensor the touch sensor to be checked, eg: TouchSensor.T0
     * @param action the trigger action
     * @param handler body code to run when the event is raised
     */
    //% blockId=mpr121x4_touch_on_touch_sensor
    //% block="if sensor | %sensor | on board | %board | is | %action"
    //% board.min=0 board.max=3 board.defl=0
    //% sensor.fieldEditor="gridpicker" sensor.fieldOptions.columns=6
    //% sensor.fieldOptions.tooltips="false"
    //% weight=65
    export function onTouch(
        sensor: TouchSensor,
        board: number, //JRH001
        action: TouchAction,
        handler: () => void
    ) {
        initTouchController(board); // JRH002
        if (action === TouchAction.Touched) {
            serial.writeLine(
                `onTouch - touch action for board ${board} sensor ${sensor}`
            );
            touchState[board].onTouched.push(new TouchHandler(sensor, handler)); // JRH002
        } else {
            serial.writeLine(
                `onTouch - released action for board ${board} sensor ${sensor}`
            );
            touchState[board].onReleased.push(new TouchHandler(sensor, handler)); // JRH002
        }
    }

    /**
     * Returns the sensor index of the last touch event that was received.
     * It could be either a sensor touched or released event.
     */
    //% blockId=mpr121x4_touch_current_touch_sensor
    //% block="last sensor touched on board | %board "
    //% board.min=0 board.max=3 board.defl=0
    //% weight=50
    export function touchSensor(board: number): number {
        initTouchController(board);
        if (touchState[board].eventValue !== 0) {
            return getSensorIndexFromSensorBitField(touchState[board].eventValue); // JRH002
        } else {
            return -1; // no sensor was active
        }
    }

    function getSensorIndexFromSensorBitField(touchSensorBit: TouchSensor) {
        if (touchSensorBit === TouchSensor.Any) {
            return TouchSensor.Any;
        }

        let bit = TouchSensor.T0; // 7/30/22 renumbering fix
        for (let sensorIndex = 0; sensorIndex <= 11; sensorIndex++) {
            if ((bit & touchSensorBit) !== 0) {
                return sensorIndex; // return first hit
            }
            bit <<= 1; // 7/26 yet another fix
        }
        return 0;
    }

    function getTouchSensorFromIndex(index: number): TouchSensor {
        if (0 <= index && index <= 11) {
            return TouchSensor.T0 << index; // 7/30/22 renumbering fix
        } else if (index === TouchSensor.Any) {
            return TouchSensor.Any;
        } else {
            return 0;
        }
    }

    /**
     * Returns true if a specific touch sensor is currently touched. False otherwise.
     * @param sensor the touch sensor to be checked, eg: TouchSensor.T5
     */
    //% blockId=mpr121x4_touch_is_touch_sensor_touched
    //% block="sensor | %sensor | on board | %board |  is touched"
    //% board.min=0 board.max=3 board.defl=0
    //% sensor.fieldEditor="gridpicker" sensor.fieldOptions.columns=6
    //% sensor.fieldOptions.tooltips="false"
    //% weight=40
    //% blockHidden=true
    export function isSensorTouched(sensor: TouchSensor, board: number): boolean {
        // JRH002
        initTouchController(board); // JRH002
        if (sensor === TouchSensor.Any) {
            return touchState[board].touchStatus !== 0; // JRH002
        } else {
            return (touchState[board].touchStatus & sensor) !== 0; // JRH002
        }
    }

    /**
     * Turns a TouchSensor into its index value.
     * @param sensor the touch sensor, eg: TouchSensor.T0
     */
    //% blockId=mpr121x4_touch_sensor_index
    //% block="%touchSensorIndex"
    //% sensor.fieldEditor="gridpicker" sensor.fieldOptions.columns=6
    //% sensor.fieldOptions.tooltips="false"
    //% blockHidden=true
    export function touchSensorIndex(sensor: TouchSensor): number {
        return getSensorIndexFromSensorBitField(sensor);
    }

    /**
     * Returns true if a specific touch sensor is currently touched. False otherwise.
     * @param sensorIndex the touch sensor index to be checked
     */
    //% blockId="mpr121x4_touch_is_touch_sensor_index_touched"
    //% block="sensor | %sensorIndex=mpr121x4_touch_sensor_index | on board | %board |  is touched"
    //% board.min=0 board.max=3 board.defl=0
    //% weight=42
    export function isTouched(sensorIndex: number, board: number): boolean {
        return isSensorTouched(board, getTouchSensorFromIndex(sensorIndex)); // JRH004
    }

    /**
     * Returns true if any sensor was touched since the last call of this function. False otherwise.
     */
    //% blockId=mpr121x4_touch_was_any_sensor_touched
    //% block="some sensor was touched on board | %board "
    //% board.min=0 board.max=3 board.defl=0
    //% weight=41
    export function wasTouched(board: number): boolean {
        initTouchController(board); // JRH002
        if (touchState[board].hasNewTouchedEvent) {
            // JRH002
            touchState[board].hasNewTouchedEvent = false; // JRH002
            return true;
        } else {
            return false;
        }
    }

    // Communication module for MPR121 capacitive touch sensor controller
    // https://www.sparkfun.com/datasheets/Components/MPR121.pdf
    export namespace mpr121 {
        const CalibrationLock_BaselineTrackingAndInitialize = 0b11;
        const Proximity_DISABLED = 0b00;
        const Touch_ELE_0_TO_11 = 0b1100;

        export const enum Config {
            MHDR = 0x2b,
            NHDR = 0x2c,
            NCLR = 0x2d,
            FDLR = 0x2e,
            MHDF = 0x2f,
            NHDF = 0x30,
            NCLF = 0x31,
            FDLF = 0x32,
            NHDT = 0x33,
            NCLT = 0x34,
            FDLT = 0x35,

            MHDPROXR = 0x36,
            NHDPROXR = 0x37,
            NCLPROXR = 0x38,
            FDLPROXR = 0x39,
            MHDPROXF = 0x3a,
            NHDPROXF = 0x3b,
            NCLPROXF = 0x3c,
            FDLPROXF = 0x3d,
            NHDPROXT = 0x3e,
            NCLPROXT = 0x3f,
            FDLPROXT = 0x40,

            E0TTH = 0x41,
            E0RTH = 0x42,

            DTR = 0x5b,
            AFE1 = 0x5c,
            AFE2 = 0x5d,
            ECR = 0x5e,

            AUTO_CONFIG_0 = 0x7b,
            AUTO_CONFIG_1 = 0x7c,
            AUTO_CONFIG_USL = 0x7d,
            AUTO_CONFIG_LSL = 0x7e,
            AUTO_CONFIG_TL = 0x7f,
        }

        function writeCommandData(
            address: number,
            command: number,
            data: number
        ): void {
            const commandDataBuffer = pins.createBuffer(
                pins.sizeOf(NumberFormat.UInt16BE)
            );
            commandDataBuffer.setNumber(
                NumberFormat.UInt16BE,
                0,
                (command << 8) | data
            );
            pins.i2cWriteBuffer(address, commandDataBuffer);
        }

        function writeCommand(address: number, command: number): void {
            const commandBuffer = pins.createBuffer(
                pins.sizeOf(NumberFormat.UInt8BE)
            );
            commandBuffer.setNumber(NumberFormat.UInt8BE, 0, command);
            pins.i2cWriteBuffer(address, commandBuffer);
        }

        export function configure(
            address: number,
            register: Config,
            value: number
        ): void {
            writeCommandData(address, register, value);
        }

        export function configureThresholds(
            address: number,
            touch: number,
            release: number
        ): void {
            for (let i = 0; i < 12; i++) {
                configure(address, Config.E0TTH + i * 2, touch);
                configure(address, Config.E0RTH + i * 2, release);
            }
        }

        export function reset(address: number): void {
            writeCommandData(address, 0x80, 0x63);
            basic.pause(30);
        }

        export function stop(address: number): void {
            writeCommandData(address, Config.ECR, 0x0);
        }

        export function start(address: number): void {
            writeCommandData(
                address,
                Config.ECR,
                (CalibrationLock_BaselineTrackingAndInitialize << 6) |
                (Proximity_DISABLED << 4) |
                Touch_ELE_0_TO_11
            );
        }

        export function readTouchStatus(address: number): number {
            writeCommand(address, 0x0);
            return pins.i2cReadNumber(address, NumberFormat.UInt16LE);
        }
    }
}
