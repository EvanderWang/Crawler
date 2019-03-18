//import request from "sync-request";
//import * as asyncrequest from "request";
//import * as cheerio from "cheerio";
//import xlsx from 'node-xlsx'; 
//import * as fs from "fs";
//import * as FormData from 'form-data';

//import * as Excel from 'exceljs';

//let totalmarkcount = 0;

//let refuseSquare = 65;
//let maxPrize = 400;
//let minPrize = 100;
//let checkSchool = false;

//class VSchoolList {
//    constructor(public keywords: Array<string>) { }
//}

//class VSubRegion {
//    constructor(public urlpart: string, public name: string) { }
//}

//class VSearchSubReigonList {
//    constructor(public subreigons: Array<VSubRegion>) { }
//}

//class VHouseSchoolMapping {
//    mapxlsx: { name: string, data: Array<Array<string>> };
//    constructor(xlsfile: string) {
//        this.mapxlsx = xlsx.parse(xlsfile)[0];
//    }
//}

//class VSchoolInfo {
//    constructor(public l1: VSchoolList
//        , public l2: VSchoolList
//        , public map: VHouseSchoolMapping
//    ) {}
//}

//class VRegion {
//    constructor(public name: string
//        , public ssr: VSearchSubReigonList
//        , public primary: VSchoolInfo
//        , public junior: VSchoolInfo | null
//    ) { }
//}

//class VSchoolFindResult {
//    needMark: boolean;
//    schoolName: string;
//    schoolLevel: string;
//}

//class VXiaoqu {
//    name: string;
//    metros: Array<[string, number]>;
//}

//class VAsyncSearcher {
//    url_basepart: string = 'https://sh.lianjia.com/ershoufang/';
//    url_pagepart: string = '/pg'
//    //url_conditionpart: string = 'l2bp200ep400/';

//    constructor(private url_conditionpart: string) { }

//    searchRegion(region: VRegion, suc: (data: Array<Array<string>>) => void) {
//        console.log("start search region : " + region.name);
//        let rtValue = new Array<Array<string>>();
//        let curidx = 0;

//        let backcount = 0;
//        let search = () => {
//            let i = curidx;
//            curidx += 1;

//            this.searchSubRegion(region.ssr.subreigons[i], region.primary, region.junior, (data: Array<Array<string>>) => {
//                rtValue = rtValue.concat(data);

//                backcount += 1;
//                if (backcount == region.ssr.subreigons.length) {
//                    suc(rtValue);
//                } else {
//                    search();
//                }
//            });
//        }
//        search();
//    }

//    searchSubRegion(sr: VSubRegion, primary: VSchoolInfo, junior: VSchoolInfo | null, suc: (data: Array<Array<string>>) => void) {
//        console.log("start search sub region : " + sr.name);
//        let rtValue = new Array<Array<string>>();
       
//        let listpage = request("GET", this.url_basepart + sr.urlpart + '/' + this.url_conditionpart);
//        let listpagebody = (<Buffer>listpage.getBody()).toString();

//        let findidx = listpagebody.indexOf('"total fl"');
//        let countsidx = listpagebody.indexOf('<span>', findidx) + 6;
//        let counteidx = listpagebody.indexOf('</span>', findidx);
//        let count = Number(listpagebody.substr(countsidx, counteidx - countsidx).trim());

//        let pagecount = 0;
//        if (count != 0) {
//            pagecount = Math.ceil(count / 30);
//        }

//        if (pagecount == 0) {
//            suc(rtValue);
//        }

//        //let finishpagecount = 0;
//        //let pagefinish = (data: Array<Array<string>>) => {
//        //    rtValue = rtValue.concat(data);
//        //    finishpagecount += 1;
//        //    if (finishpagecount == pagecount) {
//        //        suc(rtValue);
//        //    }
//        //}
//        //
//        //for (let i = 1; i <= pagecount; i++) {
//        //    console.log("start search sub region " + sr.name + " page : " + i.toString());
//        //    this.searchPage(i, sr, primary, junior, pagefinish);
//        //}

//        let curidx = 0;
//        let backcount = 0;
//        let search = () => {
//            curidx += 1;
//            let i = curidx;
//            console.log("start search sub region " + sr.name + " page : " + i.toString());
        
//            this.searchPage(i, sr, primary, junior, (data: Array<Array<string>>) => {
//                backcount += 1;
//                rtValue = rtValue.concat(data);
//                if (backcount == pagecount) {
//                    suc(rtValue);
//                } else {
//                    search();
//                }
//            });
//        }
//        search();
//    }

//    private searchPage(pagenumber: number, sr: VSubRegion, primary: VSchoolInfo, junior: VSchoolInfo | null, suc: (data: Array<Array<string>>) => void) {
//        let rtValue = new Array<Array<string>>();

//        let trycount = 0;
//        let markcount = 0;

//        asyncrequest(this.url_basepart + sr.urlpart + this.url_pagepart + pagenumber.toString() + this.url_conditionpart, (error: any, response: any, body: any) => {
//            if (!error && response.statusCode == 200) {
//                let listpagebody = body;
//                let listpage$ = cheerio.load(listpagebody);
//                let v = listpage$('.sellListContent');
//                let houses = v.children();
//                let housescount = houses.length;

//                let finishhousecount = 0;
//                for (let i = 0; i < houses.length; i++) {
//                    this.trymarkHouse(houses[i], listpage$, sr.name, primary, junior, (data: Array<string> | null) => {
//                        if (data) {
//                            markcount += 1;
//                            console.log(sr.name + " page " + pagenumber + " finish mark : " + markcount.toString());
//                            rtValue.push(data);
//                        }
//                        trycount += 1;
//                        console.log(sr.name + " page " + pagenumber + " finish try : " + trycount.toString());

//                        finishhousecount += 1;
//                        if (finishhousecount == housescount) {
//                            suc(rtValue);
//                        }
//                    });
//                }
//            } else {
//                suc(rtValue);
//            }
//        });
//    }

//    private trymarkHouse(house: cheerio.Element, listpage$: cheerio.Static, srname: string, primary: VSchoolInfo, junior: VSchoolInfo | null, suc: (data: Array<string> | null) => void) {
//        let rtValue: Array<string> | null = null;

//        let xiaoquurl = house.children[1].children[1].children[0].children[1].attribs["href"];
//        let xiaoquName = listpage$(house.children[1].children[1].children[0].children[1]).text();
//        let detailurl = house.children[0].attribs["href"];

//        asyncrequest(xiaoquurl, (error: any, response: any, body: any) => {
//            if (!error && response.statusCode == 200) {
//                let xiaoqupagebody = body;
//                let xiaoqupage$ = cheerio.load(xiaoqupagebody);
//                let xiaoquLocationStr = xiaoqupage$('.detailDesc').text();
//                let xiaoquLocations = xiaoquLocationStr.split(',');
//                for (let i = 0; i < xiaoquLocations.length; i++) {
//                    let b = xiaoquLocations[i].lastIndexOf(")");
//                    let loc = xiaoquLocations[i].substr(b + 1, xiaoquLocations[i].length - b - 1);
//                    xiaoquLocations[i] = loc;
//                }

//                let primaryResult: VSchoolFindResult = this.findSchool(xiaoquName, xiaoquLocations, primary);
//                let juniorResult: VSchoolFindResult | null = null;
//                if (junior) {
//                    juniorResult = this.findSchool(xiaoquName, xiaoquLocations, junior);
//                }

//                if (checkSchool) {
//                    if (primaryResult.needMark) {
//                        rtValue = this.markHouse(house, listpage$, srname, primaryResult, juniorResult);
//                    }
//                } else {
//                    rtValue = this.markHouse(house, listpage$, srname, primaryResult, juniorResult);
//                }

//                suc(rtValue);
//            } else {
//                suc(rtValue);
//            }
//        });
//    }

//    private markHouse(house: cheerio.Element, listpage$: cheerio.Static, srname: string, primaryResult: VSchoolFindResult, juniorResult: VSchoolFindResult | null): Array<string> | null {
//        let detailurl = house.children[0].attribs["href"];
//        let xiaoquname = listpage$(house.children[1].children[1].children[0].children[1]).text();
//        let price = listpage$(house.children[1].children[5].children[0].children[0]).text();
//        let houseinfo = listpage$(house.children[1].children[1].children[0]).text();
//        let houseinfos = houseinfo.split('|');
//        let size = "没找到";
//        for (let i = 0; i < houseinfos.length; i++) {
//            if (houseinfos[i].indexOf("平米") != -1) {
//                size = houseinfos[i].substr(0, houseinfos[i].indexOf("平米"));
//                break;
//            }
//        }
//        if (Number(size) < refuseSquare) {
//            return null;
//        }

//        let levelinfo = listpage$(house.children[1].children[2].children[0]).text();
//        let levelinfos = levelinfo.split('-');
//        let level = levelinfos[0];

//        totalmarkcount += 1;
//        return [xiaoquname, srname, price, (Number(price) * 0.35).toFixed(2), size, (Number(price) / Number(size)).toFixed(3), level, primaryResult.schoolName, primaryResult.schoolLevel, juniorResult ? juniorResult.schoolName : "unknown", juniorResult ? juniorResult.schoolLevel : "unknown", detailurl];
//    }

//    private findSchool(xiaoquName: string, xiaoquLocations: string[], si: VSchoolInfo): VSchoolFindResult {
//        let rtValue = new VSchoolFindResult();
//        let school = "";

//        for (let i = 0; i < xiaoquLocations.length; i++) {
//            let xiaoquLoc = xiaoquLocations[i];
//            school = this.tryGetSchool(xiaoquLoc, si.map);
//            if (school != "") {
//                break;
//            }
//        }
//        if (school == "") {
//            school = this.tryGetSchool(xiaoquName, si.map);
//        }

//        if (school != "") {
//            rtValue.needMark = true;
//            rtValue.schoolName = school;
//            if (this.checkSchoolInList(school, si.l1)) {
//                rtValue.schoolLevel = "一梯队";
//            } else if (this.checkSchoolInList(school, si.l2)) {
//                rtValue.schoolLevel = "二梯队";
//            } else {
//                rtValue.needMark = false;
//                rtValue.schoolLevel = "未列入";
//            }
//        } else {
//            rtValue.needMark = false;
//            rtValue.schoolName = "unknown";
//            rtValue.schoolLevel = "unknown";
//        }

//        return rtValue;
//    }

//    private tryGetSchool(roadorname: string, mapping: VHouseSchoolMapping): string {
//        for (let i = 1; i < mapping.mapxlsx.data.length; i++) {
//            if (mapping.mapxlsx.data[i][5] == roadorname || mapping.mapxlsx.data[i][6] == roadorname) {
//                return mapping.mapxlsx.data[i][3];
//            }
//        }
//        return "";
//    }

//    private checkSchoolInList(schoolname: string, list: VSchoolList): boolean {
//        for (let i = 0; i < list.keywords.length; i++) {
//            if (schoolname.indexOf(list.keywords[i]) != -1) {
//                return true;
//            }
//        }
//        return false;
//    }
//}

//class VSyncSearcher {
//    url_basepart: string = 'https://sh.lianjia.com/ershoufang/';
//    url_pagepart: string = '/pg'
//    //url_conditionpart: string = 'l2bp200ep400/';

//    constructor(private url_conditionpart: string) { }

//    searchReigon(region: VRegion): Array<Array<string>> {
//        console.log("start search region : " + region.name);
//        let rtValue = new Array<Array<string>>();
//        for (let i = 0; i < region.ssr.subreigons.length; i++) {
//            rtValue = rtValue.concat(this.searchSubRegion(region.ssr.subreigons[i], region.primary, region.junior));
//        }
//        return rtValue;
//    }

//    searchSubRegion(sr: VSubRegion, primary: VSchoolInfo, junior: VSchoolInfo | null): Array<Array<string>> {
//        console.log("start search sub region : " + sr.name);
//        let rtValue = new Array<Array<string>>();
//        let curpage = 1;
//        let trycount = 0;
//        let markcount = 0;
//        let flag_continue = true;

//        while (flag_continue) {
//            console.log("start search sub region page : " + curpage.toString());

//            let listpage = request("GET", this.url_basepart + sr.urlpart + this.url_pagepart + curpage.toString() + this.url_conditionpart);
//            let listpagebody = (<Buffer>listpage.getBody()).toString();

//            let findidx = listpagebody.indexOf('"total fl"');
//            let countsidx = listpagebody.indexOf('<span>', findidx) + 6;
//            let counteidx = listpagebody.indexOf('</span>', findidx);
//            let count = Number(listpagebody.substr(countsidx, counteidx - countsidx).trim());

//            let pagecount = 0;
//            if (count != 0) {
//                pagecount = Math.floor(count / 30) + 1;
//            }

//            if (pagecount == 0) {
//                return rtValue;
//            }

//            let listpage$ = cheerio.load(listpagebody);
//            let v = listpage$('.sellListContent');
//            let houses = v.children();
//            for (let i = 0; i < houses.length; i++) {
//                let houseResult = this.trymarkHouse(houses[i], listpage$, sr.name, primary, junior);
//                if (houseResult) {
//                    markcount += 1;
//                    console.log("finish mark : " + markcount.toString());
//                    rtValue.push(houseResult);
//                }

//                trycount += 1;
//                console.log("finish try : " + trycount.toString());
//            }

//            curpage += 1;
//            if (curpage > pagecount) {
//                flag_continue = false;
//            }
//        }

//        return rtValue;
//    }

//    private trymarkHouse(house: cheerio.Element, listpage$: cheerio.Static, srname: string, primary: VSchoolInfo, junior: VSchoolInfo | null): Array<string> | null {
//        let rtValue: Array<string> | null = null;

//        let xiaoquurl = house.children[1].children[1].children[0].children[1].attribs["href"];
//        let xiaoquName = listpage$(house.children[1].children[1].children[0].children[1]).text();
//        let detailurl = house.children[0].attribs["href"];

//        let xiaoqupage = request("GET", xiaoquurl);
//        let xiaoqupagebody = (<Buffer>xiaoqupage.getBody()).toString();

//        let xiaoqupage$ = cheerio.load(xiaoqupagebody);
//        let xiaoquLocationStr = xiaoqupage$('.detailDesc').text();
//        let xiaoquLocations = xiaoquLocationStr.split(',');
//        for (let i = 0; i < xiaoquLocations.length; i++) {
//            let b = xiaoquLocations[i].lastIndexOf(")");
//            let loc = xiaoquLocations[i].substr(b + 1, xiaoquLocations[i].length - b - 1);
//            xiaoquLocations[i] = loc;
//        }

//        let primaryResult: VSchoolFindResult = this.findSchool(xiaoquName, xiaoquLocations, primary);
//        let juniorResult: VSchoolFindResult | null = null;
//        if (junior) {
//            juniorResult = this.findSchool(xiaoquName, xiaoquLocations, junior);
//        }

//        if (checkSchool) {
//            if (primaryResult.needMark) {
//                rtValue = this.markHouse(house, listpage$, srname, primaryResult, juniorResult);
//            }
//        } else {
//            rtValue = this.markHouse(house, listpage$, srname, primaryResult, juniorResult);
//        }

//        return rtValue;
//    }

//    private markHouse(house: cheerio.Element, listpage$: cheerio.Static, srname: string, primaryResult: VSchoolFindResult, juniorResult: VSchoolFindResult | null): Array<string> | null {
//        let detailurl = house.children[0].attribs["href"];
//        let xiaoquname = listpage$(house.children[1].children[1].children[0].children[1]).text();
//        let price = listpage$(house.children[1].children[5].children[0].children[0]).text();
//        let houseinfo = listpage$(house.children[1].children[1].children[0]).text();
//        let houseinfos = houseinfo.split('|');
//        let size = "没找到";
//        for (let i = 0; i < houseinfos.length; i++) {
//            if (houseinfos[i].indexOf("平米") != -1) {
//                size = houseinfos[i];
//                break;
//            }
//        }
//        if (Number(size) < refuseSquare) {
//            return null;
//        }

//        let levelinfo = listpage$(house.children[1].children[2].children[0]).text();
//        let levelinfos = levelinfo.split('-');
//        let level = levelinfos[0];

//        totalmarkcount += 1;
//        return [xiaoquname, srname, price, (Number(price) * 0.35).toFixed(2), size, (Number(price) / Number(size)).toFixed(3), level, primaryResult.schoolName, primaryResult.schoolLevel, juniorResult ? juniorResult.schoolName : "unknown", juniorResult ? juniorResult.schoolLevel : "unknown", detailurl];
//    }

//    private findSchool(xiaoquName: string, xiaoquLocations: string[], si: VSchoolInfo): VSchoolFindResult {
//        let rtValue = new VSchoolFindResult();
//        let school = "";

//        for (let i = 0; i < xiaoquLocations.length; i++) {
//            let xiaoquLoc = xiaoquLocations[i];
//            school = this.tryGetSchool(xiaoquLoc, si.map);
//            if (school != "") {
//                break;
//            }
//        }
//        if (school == "") {
//            school = this.tryGetSchool(xiaoquName, si.map);
//        }

//        if (school != "") {
//            rtValue.needMark = true;
//            rtValue.schoolName = school;
//            if (this.checkSchoolInList(school, si.l1)) {
//                rtValue.schoolLevel = "一梯队";
//            } else if (this.checkSchoolInList(school, si.l2)){
//                rtValue.schoolLevel = "二梯队";
//            } else {
//                rtValue.needMark = false;
//                rtValue.schoolLevel = "未列入";
//            }
//        } else {
//            rtValue.needMark = false;
//            rtValue.schoolName = "unknown";
//            rtValue.schoolLevel = "unknown";
//        }

//        return rtValue;
//    }

//    private tryGetSchool(roadorname: string, mapping: VHouseSchoolMapping): string {
//        for (let i = 1; i < mapping.mapxlsx.data.length; i++) {
//            if (mapping.mapxlsx.data[i][5] == roadorname || mapping.mapxlsx.data[i][6] == roadorname) {
//                return mapping.mapxlsx.data[i][3];
//            }
//        }
//        return "";
//    }

//    private checkSchoolInList(schoolname: string, list: VSchoolList): boolean {
//        for (let i = 0; i < list.keywords.length; i++) {
//            if (schoolname.indexOf(list.keywords[i]) != -1) {
//                return true;
//            }
//        }
//        return false;
//    }
//}

//class VExporter {
//    condition: string = 'bp' + minPrize + 'ep' + maxPrize + '/';
//    filteredSheets: Array<{ name: string, data: Array<Array<string>> }>;

//    constructor(public export_file: string, public regions: Array<VRegion>) {
//        this.filteredSheets = new Array<{ name: string, data: Array<Array<string>> }>();

//        for (let i = 0; i < regions.length; i++) {
//            let filtered = new Array<Array<string>>();
//            filtered.push(["小区名称", "区域", "总价", "首付", "平米", "单价", "楼层年代", "对口小学", "小学等级", "对口中学", "中学等级", "网页地址"]);
//            this.filteredSheets.push({ name: regions[i].name, data: filtered });
//        }

//        this.asyncbuild();
//    }

//    private syncbuild() {
//        let searcher = new VSyncSearcher(this.condition);
//        for (let i = 0; i < this.regions.length; i++) {
//            let searchResult = searcher.searchReigon(this.regions[i]);
//            this.filteredSheets[i].data = this.filteredSheets[i].data.concat(searchResult);
//        }
//        this.export();
//    }

//    private asyncbuild() {
//        let searcher = new VAsyncSearcher(this.condition);
//        let curidx = 0;

//        let finishcount = 0;
//        let dosearch = () => {
//            if (curidx < this.regions.length) {
//                let i = curidx;
//                curidx += 1;
//                searcher.searchRegion(this.regions[i], (searchResult: Array<Array<string>>) => {
//                    this.filteredSheets[i].data = this.filteredSheets[i].data.concat(searchResult);
//                    finishcount += 1;
//                    if (finishcount == this.regions.length) {
//                        this.export();
//                    }
//                    dosearch();
//                })
//            }
//        }
//        dosearch();
//    }

//    private export() {
//        console.log("export total count = " + totalmarkcount);
//        let buffer = xlsx.build(this.filteredSheets);
//        fs.writeFileSync(this.export_file, buffer);
//    }
//}

//class VJustSchoolExporter {
//    condition: string = '/';
//    filteredSheets: Array<Array<{ name: string, data: Array<Array<string>> }>>;

//    constructor(public export_file: string, public regions: Array<VRegion>) {
//        this.filteredSheets = new Array<Array<{ name: string, data: Array<Array<string>> }>>();

//        for (let i = 0; i < regions.length; i++) {
//            let subregion = new Array<{ name: string, data: Array<Array<string>> }>();
//            for (let j = 0; j < regions[i].ssr.subreigons.length; j++) {
//                let filtered = new Array<Array<string>>();
//                filtered.push(["小区名称", "区域", "总价", "首付", "平米", "单价", "楼层年代", "对口小学", "小学等级", "对口中学", "中学等级", "网页地址"]);
//                subregion.push({ name: regions[i].ssr.subreigons[j].name, data: filtered });
//            }
//            this.filteredSheets.push(subregion);
//        }

//        this.asyncbuild();
//    }

//    private syncbuild() {
//        let searcher = new VSyncSearcher(this.condition);
//        for (let i = 0; i < this.regions.length; i++) {
//            for (let j = 0; j < this.regions[i].ssr.subreigons.length; j++) {
//                let searchResult = searcher.searchSubRegion(this.regions[i].ssr.subreigons[j], this.regions[i].primary, this.regions[i].junior);
//                this.filteredSheets[i][j].data = this.filteredSheets[i][j].data.concat(searchResult);
//            }
//        }
//        this.export();
//    }

//    private asyncbuild() {
//        let searcher = new VAsyncSearcher(this.condition);
//        let curidx = 0;
//        let cursubidx = 0;

//        let finishcount = 0;
//        let dosearch = () => {
//            if (curidx < this.regions.length) {
//                let i = curidx;
//                let j = cursubidx;
//                cursubidx += 1;
//                searcher.searchSubRegion(this.regions[i].ssr.subreigons[j], this.regions[i].primary, this.regions[i].junior, (searchResult: Array<Array<string>>) => {
//                    this.filteredSheets[i][j].data = this.filteredSheets[i][j].data.concat(searchResult);
//                    if (cursubidx == this.regions[i].ssr.subreigons.length) {
//                        curidx += 1;
//                        cursubidx = 0;
//                        dosearch();
//                    } else {
//                        dosearch();
//                    }
//                })
//            } else {
//                this.export();
//            }
//        }
//        dosearch();
//    }

//    private export() {
//        console.log("export total count = " + totalmarkcount);
//        let out = new Array<{ name: string, data: Array<Array<string>> }>();
//        for (let i = 0; i < this.filteredSheets.length; i++) {
//            for (let j = 0; j < this.filteredSheets[i].length; j++) {
//                out.push(this.filteredSheets[i][j]);
//            }
//        }

//        let buffer = xlsx.build(out);
//        fs.writeFileSync(this.export_file, buffer);
//    }
//}

//class VRegionBuilder {
//    static Build(name: string, buildinfoxlsx: string, pschoolxlsx: string, jschoolxlsx: string | null): VRegion {
//        let bi = xlsx.parse(buildinfoxlsx);
//        let searchregioninfo: { name: string, data: Array<Array<string>> } = bi[0];
//        let pschoolinfo: { name: string, data: Array<Array<string>> } = bi[1];
//        let jschoolinfo: { name: string, data: Array<Array<string>> } = bi[2];

//        let ssr = this.BuildSubRegion(searchregioninfo);
//        let primary = this.BuildSchoolInfo(pschoolinfo, pschoolxlsx);
//        let junior: VSchoolInfo | null = null;
//        if (jschoolxlsx)
//            junior = this.BuildSchoolInfo(jschoolinfo, jschoolxlsx);

//        return new VRegion(name, ssr, primary, junior);
//    }

//    private static BuildSubRegion(info: { name: string, data: Array<Array<string>> }): VSearchSubReigonList {
//        let subregionlist = new Array<VSubRegion>();
//        for (let i = 1; i < info.data.length; i++) {
//            let name = info.data[i][0];
//            let urlpart = info.data[i][1];
//            subregionlist.push(new VSubRegion(urlpart, name));
//        }
//        return new VSearchSubReigonList(subregionlist);
//    }

//    private static BuildSchoolInfo(info: { name: string, data: Array<Array<string>> }, schoolxlsx: string): VSchoolInfo {
//        let l1 = this.BuildSchoolList(info, 0);
//        let l2 = this.BuildSchoolList(info, 1);
//        let map = new VHouseSchoolMapping(schoolxlsx);
//        return new VSchoolInfo(l1, l2, map);
//    }

//    private static BuildSchoolList(info: { name: string, data: Array<Array<string>> }, clm: number): VSchoolList {
//        let schoollist = new Array<string>();
//        for (let i = 1; i < info.data.length; i++) {
//            let name = info.data[i][clm];
//            if (name && name != "")
//                schoollist.push(name);
//        }
//        return new VSchoolList(schoollist);
//    }
//}

//let pudongregion = VRegionBuilder.Build("浦东", "D:\\OneDrive\\House\\pudong_build.xlsx", "D:\\OneDrive\\House\\pudong_xiaoxue.xls", "D:\\OneDrive\\House\\pudong_zhongxue.xls");
//let xuhuiregion = VRegionBuilder.Build("徐汇", "D:\\OneDrive\\House\\xuhui_build.xlsx", "D:\\OneDrive\\House\\xuhui_xiaoxue.xlsx", null);
////let exporter = new VExporter("D:\\result.xlsx", [pudongregion, xuhuiregion]);

//let checkPos = encodeURI("https://restapi.amap.com/v3/geocode/geo?address=南新一村(下南路161弄)&city=021&key=8773b253e90d818c707fda86c48e7e34");

//asyncrequest(checkPos, (error: any, response: any, body: any) => {
//    if (!error && response.statusCode == 200) {
//        let returndata = JSON.parse(response.body);
//        if (returndata.status == 1) {
//            let pos = returndata.geocodes[0].location;

//            let checkMetro = encodeURI("https://restapi.amap.com/v3/place/around?location=" + pos + "&types=150500&radius=2500&city=021&key=8773b253e90d818c707fda86c48e7e34");

//            asyncrequest(checkMetro, (error: any, response: any, body: any) => {
//                if (!error && response.statusCode == 200) {
//                    let returndata = JSON.parse(response.body);
//                    if (returndata.status == 1) {
//                        let metroName = returndata.pois[0].name;
//                        let metroDis = returndata.pois[0].distance;
//                        let metroPos = returndata.pois[0].location;

//                        let checkWalkDis = encodeURI("https://restapi.amap.com/v3/direction/walking?origin=" + pos + "&destination=" + metroPos + "&key=8773b253e90d818c707fda86c48e7e34");

//                        asyncrequest(checkWalkDis, (error: any, response: any, body: any) => {
//                            if (!error && response.statusCode == 200) {
//                                let returndata = JSON.parse(response.body);
//                                if (returndata.status == 1) {
//                                    let walkDis = returndata.route.paths[0].distance;
//                                    let walkDur = returndata.route.paths[0].duration;
//                                }
//                            }
//                        });

//                        let checkBicycleDis = encodeURI("https://restapi.amap.com/v4/direction/bicycling?origin=" + pos + "&destination=" + metroPos + "&key=8773b253e90d818c707fda86c48e7e34");

//                        asyncrequest(checkBicycleDis, (error: any, response: any, body: any) => {
//                            if (!error && response.statusCode == 200) {
//                                let returndata = JSON.parse(response.body);
//                                if (returndata.errcode == 0) {
//                                    let bicycleDis = returndata.data.paths[0].distance;
//                                    let bicycleDur = returndata.data.paths[0].duration;
//                                }
//                            }
//                        });
//                    }
//                }
//            });
//        }
//    }
//});

////const workbook = new Excel.Workbook();
////
////let myBase64Image = "data:image/jpeg;base64,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";
////let imageId = workbook.addImage({
////    base64: myBase64Image,
////    extension: 'jpeg',
////});
////
////let sheet = workbook.addWorksheet('My Sheet');
//////sheet.addRow([1]);
////
////sheet.addImage(imageId, {
////    tl: { col: 0, row: 0 },
////    br: { col: 1, row: 1 }
////});
////
////let row = sheet.getRow(1);
////row.height = 400;
////let col = sheet.getColumn(1);
////col.width = 600;
////
////workbook.xlsx.writeFile("D:\\test.xlsx")
////    .then(function () {
////        console.log("Test Done");
////    });

import VInfoManager from "./VInfoManager";

let infoMngr = new VInfoManager(() => {
    let x = infoMngr.primaryMap;
    let y = infoMngr.juniorMap;
    let z = infoMngr.metroMap;
});