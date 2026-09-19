import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studySetsRouter from "./study-sets";
import storageRouter from "./storage";
import notesRouter from "./notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studySetsRouter);
router.use(storageRouter);
router.use(notesRouter);

export default router;
