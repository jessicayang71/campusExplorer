import {JSZipObject} from "jszip";
import Log from "../Util";
import { IInsightFacade, InsightDataset, InsightDatasetKind, InsightResponse} from "./IInsightFacade";

/**
 * This is the main programmatic entry point for the project.
 */
export default class InsightFacade implements IInsightFacade {

    constructor() {
        Log.trace("InsightFacadeImpl::init()");
    }

    /**
     * Add a dataset to UBCInsight.
     *
     * @param id  The id of the dataset being added.
     * @param content  The base64 content of the dataset. This content should be in the form of a serialized zip file.
     * @param kind  The kind of the dataset
     *
     * @return Promise <InsightResponse>
     *
     * The promise should return an InsightResponse for both fulfill and reject.
     *
     * Fulfill should be for 2XX codes and reject for everything else.
     *
     * After receiving the dataset, it should be processed into a data structure of
     * your design. The processed data structure should be persisted to disk; your
     * system should be able to load this persisted value into memory for answering
     * queries.
     *
     * Ultimately, a dataset must be added or loaded from disk before queries can
     * be successfully answered.
     *
     * Response codes:
     *
     * 204: the operation was successful
     * 400: the operation failed. The body should contain {"error": "my text"}
     * to explain what went wrong. This should also be used if the provided dataset
     * is invalid or if it was added more than once with the same id.
     */
    public addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<InsightResponse> {
        // return the Promise<InsightResponse>
        return new Promise(function (resolve, reject) {
            // declare a promise that will be returned
            const answer: InsightResponse = {code: -1, body: null};
            // fs allows use of File System
            const fs = require("fs");
            // check if the id already exists
            fs.readdir("./datasets/", function (err: Error, files: string[]) {
                if (!err) {
                    for (let i = 0; i < files.length; i++) {
                        const test = "file[" + i + "] " + files[i];
                        Log.trace(test);
                        if (files[i] === id) {
                            answer.code = 400;
                            answer.body = {error: "a dataset with this id already exists"};
                            Log.error("400: a dataset with this id already exists");
                            reject(answer);
                        }
                    }
                }
            });
            // JSZip converts base64 string to JSZipObject using loadAsync
            const JSZip = require("jszip");
            JSZip.loadAsync(content, {base64: true})
                .then(/*loadAsync fulfills here*/function (zip: any) {
                    Log.trace("loadAsync THEN");
                    // for each file in the folder named 'courses', do stuff
                    const promiseArray: any[] = [];
                    const course: { [sections: string]: any } = [];
                    zip.folder("courses").forEach(function (relativePath: string, file: any) {
                        try {
                            const suc: string = "for each'd " + file.name;
                            Log.trace(suc);
                            // convert compressed file in 'courses' to text
                            promiseArray.push(file.async("text").then(function (text: any) {
                                try {
                                    // JSON.parse the text returned from file.async
                                    const original = JSON.parse(text);
                                    const size: string = "Size of: " + file.name + ": " + original.result.length;
                                    Log.trace(size);
                                    const msg: string = "json.stringify: " + JSON.stringify(original.result);
                                    Log.trace(msg);
                                    // for each section in the result array, parse into our own JSON
                                    for (let i = 0; i < original.result.length; i++) {
                                        try {
                                            const section: { [key: string]: any } = {
                                                courses_dept: original.result[i].Subject,
                                                courses_id: original.result[i].Course,
                                                courses_avg: original.result[i].Avg,
                                                courses_instructor: original.result[i].Professor,
                                                courses_title: original.result[i].Title,
                                                courses_pass: original.result[i].Pass,
                                                courses_fail: original.result[i].Fail,
                                                courses_audit: original.result[i].Audit,
                                                courses_uuid: original.result[i].id.toString(),
                                            };
                                            course.push(section);
                                            const sec: string = "new section[" + i + "]: " +
                                                section.courses_dept + ", " + section.courses_id + ", " +
                                                section.courses_avg + ", " + section.courses_instructor + ", " +
                                                section.courses_title + ", " + section.courses_pass + ", " +
                                                section.courses_fail + ", " + section.courses_audit + ", " +
                                                section.courses_uuid;
                                            Log.trace(sec);
                                            const fun = "new section to string: " + JSON.stringify(section);
                                            Log.trace(fun);

                                        } catch {
                                            const cat: string = "error parsing result[" + i + "]";
                                            Log.trace(cat);
                                        }
                                    }
                                } catch {
                                    const msg: string = "error parsing " + file.name;
                                    Log.trace(msg);
                                }
                            }));
                            Log.trace("loop of sections finished");
                        } catch {
                            const msg: string = "forEach failed on " + file.name;
                            Log.trace(msg);
                        }
                    });
                    Promise.all(promiseArray).then(function (result: any) {
                        const courseString = JSON.stringify(course);
                        const logCourse = "new course to string: " + courseString;
                        Log.trace(logCourse);
                        if (course.length === 0) { // TODO change this from === to !
                            answer.code = 400;
                            answer.body = {error: "no valid sections"};
                            Log.error("400: no valid sections");
                            reject(answer);
                        } else {
                            fs.mkdir("./datasets", function () {
                                fs.mkdir("./datasets/" + id, function () {
                                    Log.trace("directory 'datasets' created");
                                    // write the course to a file using a stream
                                    const logger = fs.createWriteStream("./datasets/" +
                                        id + "/" + "courses");
                                    logger.write(courseString);
                                    logger.end();
                                    Log.trace("./datasets/" + id + "/" +
                                        "courses" + " FILE CREATED");
                                    answer.code = 204;
                                    resolve(answer);
                                });
                            });
                        }
                    });
                })
                .catch(/*loadAsync rejects here*/function () {
                    Log.trace("loadAsync CATCH: can't read base64 content");
                    // loadAsync cannot read content the content, so error code 400
                    answer.code = 400;
                    answer.body = {error: "Cannot read base64 content"};
                    Log.error("400: Cannot read base64 content");
                    reject(answer);
                })
                .catch(/*file.async rejects*/ function () {
                    Log.trace("file.async CATCH: can't read json content");
                    // loadAsync cannot read content the content, so error code 400
                    answer.code = 400;
                    answer.body = {error: "Cannot read the json content"};
                    Log.error("400: Cannot read the json content");
                    reject(answer);
                });
        });
    }

    /**
     * Remove a dataset from UBCInsight.
     *
     * @param id  The id of the dataset to remove.
     *
     * @return Promise <InsightResponse>
     *
     * The promise should return an InsightResponse for both fulfill and reject.
     *
     * Fulfill should be for 2XX codes and reject for everything else.
     *
     * This will delete both disk and memory caches for the dataset for the id meaning
     * that subsequent queries for that id should fail unless a new addDataset happens first.
     *
     * Response codes:
     *
     * 204: the operation was successful.
     * 404: the operation was unsuccessful because the delete was for a resource that
     * was not previously added.
     *
     */
    public removeDataset(id: string): Promise<InsightResponse> {
        return Promise.reject({code: -1, body: null});
    }

    /**
     * Perform a query on UBCInsight.
     *
     * @param query  The query to be performed. This is the same as the body of the POST message.
     *
     * @return Promise <InsightResponse>
     *
     * The promise should return an InsightResponse for both fulfill and reject.
     *
     * Fulfill should be for 2XX codes and reject for everything else.
     *
     * Return codes:
     *
     * 200: the query was successfully answered. The result should be sent in JSON according in the response body.
     * 400: the query failed; body should contain {"error": "my text"} providing extra detail.
     */
    public performQuery(query: any): Promise<InsightResponse> {
        return Promise.reject({code: -1, body: null});
    }

    /**
     * List a list of datasets and their types.
     *
     * @return Promise <InsightResponse>
     * The promise should return an InsightResponse and will only fulfill.
     * The body of this InsightResponse will contain an InsightDataset[]
     *
     * Return codes:
     * 200: The list of added datasets was successfully returned.
     */
    public listDatasets(): Promise<InsightResponse> {
        return Promise.reject({code: -1, body: null});
    }
}
