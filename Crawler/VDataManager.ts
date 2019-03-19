import * as Excel from 'exceljs';
import HashMap = require("hashmap");
import * as SS from "./VStaticStrings";
import { Vasync } from "./async";
import { VMetroInfoManager, VMetroCreator, VMetroNearCell } from "./VMetroInfoManager";
import { VSchoolInfoManager } from "./VSchoolInfoManager";
import * as cheerio from "cheerio";
import request from "sync-request";
import * as asyncrequest from "request";

const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export enum VEDataType {
    NEW,
    KEEP_OLD,
    DOWN_PRIZE,
    UP_PRIZE,
    SELLED,
    DISAPPER,
}

export class VSDataChange {
    constructor(public type: VEDataType = VEDataType.NEW, public value: number = 0) { }
}

export var VETypeStr = ["新 : ", "旧 : ", "跌 : ", "涨 : ", "售 : ", "下 : "];
//export var VEFontColor = ["FFFFFF00", "FF000000", "FF00FF00", "FFFF0000", "FF000000", "FF000000"];
export var VEBkgColor = ["FF71D6FF", "FFFFFFFF", "FF71FB78", "FFFF6161", "FFAD3EB0", "FFB5B5B5"];

export enum VEExportInfoType {
    URL,
    CELLNAME,
    REGION,
    PRIZE,
    FIRST_PRIZE,
    SIZE,
    PRIZE_PER_SIZE,
    FLOOR_AND_YEAR,
    PRIMARY_SCHOOL,
    JUNIOR_SCHOOL,
    METRO,
    SHAPE_URI,
    CHANGE,
}

var g_fisrtRow = ["URL", "小区", "区域", "总价", "首付", "平米", "单价", "楼层年代", "小学", "中学", "地铁", "户型图", "变动"];

export class VHouse {
    url: string;
    cellname: string;
    region: string;
    prize: number;
    size: number;
    floorAndYear: string;
    shapeURI: string;
    favourate: boolean;

    constructor() { }

    loadFromExcelRow(row: Excel.Row) {
        this.url = row.getCell(VEExportInfoType.URL + 1).text;
        this.cellname = row.getCell(VEExportInfoType.CELLNAME + 1).value.toString();
        this.region = row.getCell(VEExportInfoType.REGION + 1).value.toString();
        this.prize = Number(row.getCell(VEExportInfoType.PRIZE + 1).value.toString());
        this.size = Number(row.getCell(VEExportInfoType.SIZE + 1).value.toString());
        this.floorAndYear = row.getCell(VEExportInfoType.FLOOR_AND_YEAR + 1).value.toString();
        this.shapeURI = row.getCell(VEExportInfoType.SHAPE_URI + 1).value.toString();

        if (row.actualCellCount > g_fisrtRow.length) {
            this.favourate = true;
        } else {
            this.favourate = false;
        }
    }

    loadFromPage(pageurl: string, page$: CheerioStatic) {
        this.url = pageurl;
        let view = page$('.overview');
        let img = view.children('.img');
        let content = view.children('.content');

        this.cellname = content.children('.aroundInfo').children('.communityName').children('.info ').text();
        this.region = content.children('.aroundInfo').children('.areaName').children('.info').text();
        this.prize = Number(content.children('.price ').children('.total').text());
        let sizeStr = content.children('.houseInfo').children('.area').children('.mainInfo').text();
        this.size = Number(sizeStr.slice(0, sizeStr.length - 2));
        this.floorAndYear = content.children('.houseInfo').children('.area').children('.subInfo').text() + "\n" + content.children('.houseInfo').children('.room').children('.subInfo').text();

        this.shapeURI = img.children('.thumbnail').children('.smallpic').children('li[data-desc="户型图"]').data("pic");

        this.favourate = false;
    }
}

export class VHouseUpdater {
    constructor() { }

    static UpdateHouse(house: VHouse, cb: (change: VSDataChange) => void) {
        asyncrequest(house.url, (error: any, response: any, body: any) => {
            if (!error && response.statusCode == 200) {
                let page$ = cheerio.load(response.body);

                let sellDetail = page$('.sellDetailHeader');
                if (sellDetail.length) {
                    let przRm = page$('.price isRemove');
                    if (przRm.length) {
                        cb(new VSDataChange(VEDataType.DISAPPER, Number(przRm.children('.total').text())));
                    } else {
                        let view = page$('.overview');
                        let content = view.children('.content');
                        let prize = Number(content.children('.price ').children('.total').text());

                        if (prize == house.prize) {
                            cb(new VSDataChange(VEDataType.KEEP_OLD, 0));
                        } else if (prize > house.prize) {
                            cb(new VSDataChange(VEDataType.UP_PRIZE, prize - house.prize));
                        } else {
                            cb(new VSDataChange(VEDataType.DOWN_PRIZE, prize - house.prize));
                        }
                    }
                } else {
                    let dpStr = page$('.dealTotalPrice').text();
                    let dp = Number(dpStr.slice(0, dpStr.length - 1));
                    cb(new VSDataChange(VEDataType.SELLED, dp));
                }
            } else {
                cb(new VSDataChange(VEDataType.DISAPPER, house.prize));
            }
        });
    }
}

export class VDataManager {
    datas: HashMap<string, [VHouse, VSDataChange]>;

    constructor(done: () => void, public dataFile: string = "result.xlsx") {
        this.datas = new HashMap<string, [VHouse, VSDataChange]>();
        this.loadFromExcel(done);
    }

    private loadFromExcel(done: () => void) {
        let workbook = new Excel.Workbook();
        workbook.xlsx.readFile(SS.OneDriveHouseFolder + '__temp_' + this.dataFile).then(() => {
            let sheet = workbook.getWorksheet("Sheet1");
            let waits = Vasync.createAWaitAll(sheet.rowCount - 1, done);

            let curIdx = 2;
            let update = () => {
                if (curIdx <= sheet.rowCount) {
                    let row = sheet.getRow(curIdx);
                    let house = new VHouse();
                    house.loadFromExcelRow(row);
                    let waitObj = waits[curIdx - 2];

                    let logIdx = curIdx;
                    curIdx += 1;
                    VHouseUpdater.UpdateHouse(house, (change: VSDataChange) => {
                        console.log("update house : " + logIdx);
                        this.datas.set(house.url, [house, change]);
                        waitObj.FinishFunc();
                    })

                    sleep(20).then(update);
                }
            }
            update();
        }).catch(() => {
            done();
        });
    }

    saveToExcel(miMngr: VMetroInfoManager, siMngr: VSchoolInfoManager, done: () => void) {
        let workbook = new Excel.Workbook();
        let sheet = workbook.addWorksheet("Sheet1");
        sheet.addRow(g_fisrtRow);

        let keys = this.datas.keys();
        let waits = Vasync.createAWaitAll(keys.length, () => {
            sheet.getColumn(VEExportInfoType.SHAPE_URI + 1).width = 33;
            sheet.getColumn(VEExportInfoType.METRO + 1).width = 20;
            sheet.getColumn(VEExportInfoType.FLOOR_AND_YEAR + 1).width = 16;
            sheet.getColumn(VEExportInfoType.REGION + 1).width = 25;
            sheet.getColumn(VEExportInfoType.CELLNAME + 1).width = 15;
            workbook.xlsx.writeFile(SS.OneDriveHouseFolder + this.dataFile).then(done);
        });
        for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
            let val = this.datas.get(keys[keyIdx]);

            let primarySchool = siMngr.primaryMap.has(val[0].cellname) ? siMngr.primaryMap.get(val[0].cellname).name : "unknown";
            let juniorSchool = siMngr.juniorMap.has(val[0].cellname) ? siMngr.juniorMap.get(val[0].cellname).name : "unknown";
            let metros = miMngr.metroMap.get(val[0].cellname);
            metros = metros.sort((a: VMetroNearCell, b: VMetroNearCell) => { return a.walkDis - b.walkDis; });
            let metroStr = "";
            if (metros && metros.length > 0) {
                metroStr += metros[0].name + ":" + metros[0].walkDis;
                for (let i = 1; i < metros.length; i++) {
                    if (metros[i].walkDis < 1500) {
                        metroStr += "\n" + metros[i].name + ":" + metros[i].walkDis;
                    }
                }
            }

            let rowData = [{
                text: val[0].url,
                hyperlink: val[0].url
            }
                , val[0].cellname
                , val[0].region
                , val[0].prize
                , val[0].prize * 0.35
                , val[0].size
                , val[0].prize / val[0].size
                , val[0].floorAndYear
                , primarySchool
                , juniorSchool
                , metroStr
                , val[0].shapeURI ? val[0].shapeURI : "无"
                , VETypeStr[val[1].type] + val[1].value
            ];

            if (val[0].favourate) {
                rowData.push("@");
            }

            let newRow = sheet.addRow(rowData);
            newRow.height = 96;
            newRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: VEBkgColor[val[1].type] },
            };
            //newRow.font.color = { argb: VEFontColor[val[1].type] };
            newRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        }

        workbook.xlsx.writeFile(SS.OneDriveHouseFolder + '__temp_' + this.dataFile).then(() => {
            let rowCurIdx = 1;
            for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
                let val = this.datas.get(keys[keyIdx]);

                let option = {
                    tl: { col: VEExportInfoType.SHAPE_URI, row: rowCurIdx },
                    br: { col: VEExportInfoType.SHAPE_URI + 1, row: rowCurIdx + 1 },
                    editAs: 'oneCell'
                }
                let waitObj = waits[keyIdx];

                if (val[0].shapeURI) {
                    asyncrequest(val[0].shapeURI, { encoding: null }, (error: any, response: any, body: any) => {
                        if (!error && response.statusCode == 200) {
                            let base64Data = "data:image/jpeg;base64," + Buffer.from(body).toString('base64');
                            let houseImgId = workbook.addImage({ base64: base64Data, extension: 'jpeg' });
                            sheet.addImage(houseImgId, option);
                        }
                        waitObj.FinishFunc();
                    });
                } else {
                    waitObj.FinishFunc();
                }
                rowCurIdx += 1;
            }
        });
    }
}