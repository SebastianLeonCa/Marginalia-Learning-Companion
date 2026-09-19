import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studySetsRouter from "./study-sets";
import storageRouter from "./storage";
import notesRouter from "./notes";
import recallRouter from "./recall";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studySetsRouter);
router.use(storageRouter);
router.use(notesRouter);
router.use(recallRouter);

export default router;
