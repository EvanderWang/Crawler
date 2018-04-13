import request from "sync-request";
import * as cheerio from "cheerio";
import xlsx from 'node-xlsx'; 
import * as fs from "fs";

class VSchoolList {
    constructor(public keywords: Array<string>) { }
}

class VSubRegion {
    constructor(public urlpart: string, public name: string) { }
}

class VSearchSubReigonList {
    constructor(public subreigons: Array<VSubRegion>) { }
}

class VHouseSchoolMapping {
    mapxlsx: { name: string, data: Array<Array<string>> };
    constructor(xlsfile: string) {
        this.mapxlsx = xlsx.parse(xlsfile)[0];
    }
}

class VSchoolInfo {
    constructor(public l1: VSchoolList
        , public l2: VSchoolList
        , public map: VHouseSchoolMapping
    ) {}
}

class VRegion {
    constructor(public name: string
        , public ssr: VSearchSubReigonList
        , public primary: VSchoolInfo
        , public junior: VSchoolInfo | null
    ) { }
}

class VSchoolFindResult {
    needMark: boolean;
    schoolName: string;
    schoolLevel: string;
}

class VSearcher {
    url_basepart: string = 'https://sh.lianjia.com/ershoufang/';
    url_pagepart: string = '/pg'
    url_conditionpart: string = 'l2bp200ep380/';

    constructor() { }

    searchReigon(region: VRegion): Array<Array<string>> {
        console.log("start search region : " + region.name);
        let rtValue = new Array<Array<string>>();
        for (let i = 0; i < region.ssr.subreigons.length; i++) {
            rtValue = rtValue.concat(this.searchSubRegion(region.ssr.subreigons[i], region.primary, region.junior));
        }
        return rtValue;
    }

    private searchSubRegion(sr: VSubRegion, primary: VSchoolInfo, junior: VSchoolInfo | null): Array<Array<string>> {
        console.log("start search sub region : " + sr.name);
        let rtValue = new Array<Array<string>>();
        let curpage = 1;
        let trycount = 0;
        let markcount = 0;
        let flag_continue = true;

        while (flag_continue) {
            console.log("start search sub region page : " + curpage.toString());

            let listpage = request("GET", this.url_basepart + sr.urlpart + this.url_pagepart + curpage.toString() + this.url_conditionpart);
            let listpagebody = (<Buffer>listpage.getBody()).toString();

            let tpsidx = listpagebody.indexOf('"totalPage":');
            let tpeidx = listpagebody.indexOf(',', tpsidx);
            let pagecount = Number(listpagebody.substr(tpsidx + 12, tpeidx - tpsidx - 12));

            let listpage$ = cheerio.load(listpagebody);
            let v = listpage$('.sellListContent');
            let houses = v.children();
            for (let i = 0; i < houses.length; i++) {
                let houseResult = this.trymarkHouse(houses[i], listpage$, primary, junior);
                if (houseResult) {
                    markcount += 1;
                    console.log("finish mark : " + trycount.toString());
                    rtValue.push(houseResult);
                }

                trycount += 1;
                console.log("finish try : " + trycount.toString());
            }

            curpage += 1;
            if (curpage > pagecount) {
                flag_continue = false;
            }
        }

        return rtValue;
    }

    private trymarkHouse(house: cheerio.Element, listpage$: cheerio.Static, primary: VSchoolInfo, junior: VSchoolInfo | null): Array<string> | null {
        let rtValue: Array<string> | null = null;

        let xiaoquurl = house.children[1].children[1].children[0].children[1].attribs["href"];
        let xiaoquName = listpage$(house.children[1].children[1].children[0].children[1]).text();
        let detailurl = house.children[0].attribs["href"];

        let xiaoqupage = request("GET", xiaoquurl);
        let xiaoqupagebody = (<Buffer>xiaoqupage.getBody()).toString();

        let xiaoqupage$ = cheerio.load(xiaoqupagebody);
        let xiaoquLocationStr = xiaoqupage$('.detailDesc').text();
        let xiaoquLocations = xiaoquLocationStr.split(',');
        for (let i = 0; i < xiaoquLocations.length; i++) {
            let b = xiaoquLocations[i].lastIndexOf(")");
            let loc = xiaoquLocations[i].substr(b + 1, xiaoquLocations[i].length - b - 1);
            xiaoquLocations[i] = loc;
        }

        let primaryResult: VSchoolFindResult = this.findSchool(xiaoquName, xiaoquLocations, primary);
        let juniorResult: VSchoolFindResult | null = null;
        if (junior) {
            juniorResult = this.findSchool(xiaoquName, xiaoquLocations, junior);
        }

        if (primaryResult.needMark) {
            rtValue = this.markHouse(house, listpage$, primaryResult, juniorResult);
        }
        return rtValue;
    }

    private markHouse(house: cheerio.Element, listpage$: cheerio.Static, primaryResult: VSchoolFindResult, juniorResult: VSchoolFindResult | null): Array<string> {
        let detailurl = house.children[0].attribs["href"];
        let xiaoquname = listpage$(house.children[1].children[1].children[0].children[1]).text();
        let price = listpage$(house.children[1].children[5].children[0].children[0]).text();
        let houseinfo = listpage$(house.children[1].children[1].children[0]).text();
        let houseinfos = houseinfo.split('|');
        let size = "没找到";
        for (let i = 0; i < houseinfos.length; i++) {
            if (houseinfos[i].indexOf("平米") != -1) {
                size = houseinfos[i];
                break;
            }
        }
        let levelinfo = listpage$(house.children[1].children[2].children[0]).text();
        let levelinfos = levelinfo.split('-');
        let level = levelinfos[0];

        return [xiaoquname, price, (Number(price) * 0.35), size, level, primaryResult.schoolName, primaryResult.schoolLevel, juniorResult ? juniorResult.schoolName : "unknown", juniorResult ? juniorResult.schoolLevel : "unknown", detailurl];

    }

    private findSchool(xiaoquName: string, xiaoquLocations: string[], si: VSchoolInfo): VSchoolFindResult {
        let rtValue = new VSchoolFindResult();
        let school = "";

        for (let i = 0; i < xiaoquLocations.length; i++) {
            let xiaoquLoc = xiaoquLocations[i];
            school = this.tryGetSchool(xiaoquLoc, si.map);
            if (school != "") {
                break;
            }
        }
        if (school == "") {
            school = this.tryGetSchool(xiaoquName, si.map);
        }

        if (school != "") {
            rtValue.needMark = true;
            rtValue.schoolName = school;
            if (this.checkSchoolInList(school, si.l1)) {
                rtValue.schoolLevel = "一梯队";
            } else if (this.checkSchoolInList(school, si.l2)){
                rtValue.schoolLevel = "二梯队";
            } else {
                rtValue.needMark = false;
                rtValue.schoolLevel = "未列入";
            }
        } else {
            rtValue.needMark = false;
            rtValue.schoolName = "unknown";
            rtValue.schoolLevel = "unknown";
        }

        return rtValue;
    }

    private tryGetSchool(roadorname: string, mapping: VHouseSchoolMapping): string {
        for (let i = 1; i < mapping.mapxlsx.data.length; i++) {
            if (mapping.mapxlsx.data[i][5] == roadorname || mapping.mapxlsx.data[i][6] == roadorname) {
                return mapping.mapxlsx.data[i][3];
            }
        }
        return "";
    }

    private checkSchoolInList(schoolname: string, list: VSchoolList): boolean {
        for (let i = 0; i < list.keywords.length; i++) {
            if (schoolname.indexOf(list.keywords[i]) != -1) {
                return true;
            }
        }
        return false;
    }
}

class VExporter {
    filteredSheets: Array<{ name: string, data: Array<Array<string>> }>;

    constructor(public export_file: string, public regions: Array<VRegion>) {
        this.filteredSheets = new Array<{ name: string, data: Array<Array<string>> }>();

        for (let i = 0; i < regions.length; i++) {
            let filtered = new Array<Array<string>>();
            filtered.push(["小区名称", "总价", "首付", "平米", "楼层年代", "对口小学", "小学等级", "对口中学", "中学等级", "网页地址"]);
            this.filteredSheets.push({ name: regions[i].name, data: filtered });
        }

        this.export();
        this.build();
        this.export();
    }

    private build() {
        let searcher = new VSearcher();
        for (let i = 0; i < this.regions.length; i++) {
            let searchResult = searcher.searchReigon(this.regions[i]);
            this.filteredSheets[i].data = this.filteredSheets[i].data.concat(searchResult);
        }
    }

    private export() {
        let buffer = xlsx.build(this.filteredSheets);
        fs.writeFileSync(this.export_file, buffer);
    }
}

class VRegionBuilder {
    static Build(name: string, buildinfoxlsx: string, pschoolxlsx: string, jschoolxlsx: string | null): VRegion {
        let bi = xlsx.parse(buildinfoxlsx);
        let searchregioninfo: { name: string, data: Array<Array<string>> } = bi[0];
        let pschoolinfo: { name: string, data: Array<Array<string>> } = bi[1];
        let jschoolinfo: { name: string, data: Array<Array<string>> } = bi[2];

        let ssr = this.BuildSubRegion(searchregioninfo);
        let primary = this.BuildSchoolInfo(pschoolinfo, pschoolxlsx);
        let junior: VSchoolInfo | null = null;
        if (jschoolxlsx)
            junior = this.BuildSchoolInfo(jschoolinfo, jschoolxlsx);

        return new VRegion(name, ssr, primary, junior);
    }

    private static BuildSubRegion(info: { name: string, data: Array<Array<string>> }): VSearchSubReigonList {
        let subregionlist = new Array<VSubRegion>();
        for (let i = 1; i < info.data.length; i++) {
            let name = info.data[i][0];
            let urlpart = info.data[i][1];
            subregionlist.push(new VSubRegion(urlpart, name));
        }
        return new VSearchSubReigonList(subregionlist);
    }

    private static BuildSchoolInfo(info: { name: string, data: Array<Array<string>> }, schoolxlsx: string): VSchoolInfo {
        let l1 = this.BuildSchoolList(info, 0);
        let l2 = this.BuildSchoolList(info, 1);
        let map = new VHouseSchoolMapping(schoolxlsx);
        return new VSchoolInfo(l1, l2, map);
    }

    private static BuildSchoolList(info: { name: string, data: Array<Array<string>> }, clm: number): VSchoolList {
        let schoollist = new Array<string>();
        for (let i = 1; i < info.data.length; i++) {
            let name = info.data[i][clm];
            if (name && name != "")
                schoollist.push(name);
        }
        return new VSchoolList(schoollist);
    }
}

let pudongregion = VRegionBuilder.Build("浦东", "D:\\OneDrive\\pudong_build.xlsx", "D:\\OneDrive\\pudong_xiaoxue.xls", "D:\\OneDrive\\pudong_zhongxue.xls")
let exporter = new VExporter("D:\\result.xlsx", [pudongregion]);
