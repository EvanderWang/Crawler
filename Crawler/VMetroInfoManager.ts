import * as Excel from 'exceljs';
import HashMap = require("hashmap");
import * as SS from "./VStaticStrings";
import { Vasync } from "./async";
import * as asyncrequest from "request";
import request from "sync-request";

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export class VMetroNearCell {
    constructor(public name: string, public lineDis: number, public walkDis: number, public walkDur: number) {}
}

export class VMetroCreator {
    constructor() { }

    static Create(cellname: string, city: string, cb: (info: Array<VMetroNearCell>) => void) {
        let checkPos = encodeURI(SS.Gaode_PosChecker + "address=" + cellname + city + SS.Gaode_key);
        asyncrequest(checkPos, (error: any, response: any, body: any) => {
            if (!error && response.statusCode == 200) {
                let returndata = JSON.parse(response.body);
                if (returndata.status == 1 && returndata.geocodes.length) {
                    let pos = returndata.geocodes[0].location;
                    let checkMetro = encodeURI(SS.Gaode_MetroChecker + "location=" + pos + "&types=150500&radius=2000" + city + SS.Gaode_key);
                    asyncrequest(checkMetro, (error: any, response: any, body: any) => {
                        if (!error && response.statusCode == 200) {
                            let returndata = JSON.parse(response.body);
                            if (returndata.status == 1) {
                                let metrocount = returndata.pois.length;
                                let rtValue = new Array<VMetroNearCell>();
                                let curIdx = 0;
                                let loop = () => {
                                    if (curIdx < metrocount) {
                                        let metroName = returndata.pois[curIdx].name;
                                        let metroDis = returndata.pois[curIdx].distance;
                                        let metroPos = returndata.pois[curIdx].location;
                                        rtValue.push(new VMetroNearCell(metroName, metroDis, -1, -1));
                                        let mnc = rtValue[curIdx];
                                        let checkWalkDis = encodeURI(SS.Gaode_WalkDis + "origin=" + pos + "&destination=" + metroPos + SS.Gaode_key);
                                        curIdx += 1;

                                        asyncrequest(checkWalkDis, (error: any, response: any, body: any) => {
                                            if (!error && response.statusCode == 200) {
                                                let returndata = JSON.parse(response.body);
                                                if (returndata.status == 1 && returndata.route.paths.length) {
                                                    mnc.walkDis = returndata.route.paths[0].distance;
                                                    mnc.walkDur = returndata.route.paths[0].duration;
                                                    for (let i = 1; i < returndata.route.paths.length; i++) {
                                                        if (mnc.walkDis > returndata.route.paths[i].distance) {
                                                            mnc.walkDis = returndata.route.paths[i].distance;
                                                            mnc.walkDur = returndata.route.paths[i].duration;
                                                        }
                                                    }
                                                    sleep(1200).then(loop);
                                                    return;
                                                }
                                            }
                                            console.log("error at gaode request.");
                                            cb(new Array<VMetroNearCell>());
                                        });
                                    } else {
                                        cb(rtValue);
                                    }
                                };
                                loop();
                                return;
                            } 
                        } 
                        console.log("error at gaode request.");
                        cb(new Array<VMetroNearCell>());
                    });
                    return;
                }
            } 
            console.log("error at gaode request.");
            cb(new Array<VMetroNearCell>());
        });
    }
}

export class VMetroInfoManager {
    metroMap: HashMap<string, Array<VMetroNearCell>>;

    constructor(done: () => void, public metrofile: string = "metro_info.xlsx") {
        this.metroMap = new HashMap<string, Array<VMetroNearCell>>();
        this.loadMetroCellFromExcel(done);
    }

    MarkMetro(cellname: string, city: string, done: () => void) {
        if (!this.metroMap.has(cellname)) {
            VMetroCreator.Create(cellname, city, (info: Array<VMetroNearCell>) => {
                this.metroMap.set(cellname, info);
                done();
            })
        } else {
            done();
        }
    }

    SaveMetroCells(done: () => void) {
        let workbook = new Excel.Workbook();
        let sheet = workbook.addWorksheet("Sheet1");
        sheet.addRow(["小区", "地铁站", "直线距离(m)", "步行距离(m)", "步行时间(s)"]);

        this.metroMap.forEach((val: Array<VMetroNearCell>, key: string) => {
            for (let i = 0; i < val.length; i++) {
                sheet.addRow([key, val[i].name, val[i].lineDis, val[i].walkDis, val[i].walkDur]);
            }
        });

        workbook.xlsx.writeFile(SS.OneDriveHouseFolder + this.metrofile).then(done);
    }

    private loadMetroCellFromExcel(done: () => void) {
        let workbook = new Excel.Workbook();
        workbook.xlsx.readFile(SS.OneDriveHouseFolder + this.metrofile).then(() => {
            // read
            let sheet = workbook.getWorksheet("Sheet1");
            for (let i = 2; i <= sheet.rowCount; i++) {
                let row = sheet.getRow(i);
                let cellName = row.getCell(1).value.toString();
                let metroName = row.getCell(2).value.toString();
                let lineDis = Number(row.getCell(3).value.toString());
                let walkDis = Number(row.getCell(4).value.toString());
                let walkDur = Number(row.getCell(5).value.toString());
                this.AddMetroInfo(cellName, new VMetroNearCell(metroName, lineDis, walkDis, walkDur));
            }
            done();
        }).catch(() => {
            done();
        });
    }

    private AddMetroInfo(cellName: string, info: VMetroNearCell) {
        if (!this.metroMap.has(cellName)) {
            this.metroMap.set(cellName, new Array<VMetroNearCell>());
        } 
        this.metroMap.get(cellName).push(info);
    }
}