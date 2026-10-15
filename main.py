from contextlib import asynccontextmanager
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import joblib

BASE_DIR = Path(__file__).parent
ml_model = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_model["model"] = joblib.load(BASE_DIR / "Credit_Risk_Model.pkl")
    ml_model["threshold"] = joblib.load(BASE_DIR / "Best_Threshold.pkl")
    yield
    ml_model.clear()


app = FastAPI(title="Credit Risk API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class LoanApplication(BaseModel):
    person_age: int
    person_income: float
    person_home_ownership: str
    person_emp_length: float
    loan_intent: str
    loan_grade: str
    loan_amnt: float
    loan_int_rate: float
    loan_percent_income: float
    cb_person_default_on_file: str
    cb_person_cred_hist_length: int


@app.get("/")
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(data: LoanApplication):
    input_df = pd.DataFrame([data.model_dump()])
    probability = float(ml_model["model"].predict_proba(input_df)[:, 1][0])
    threshold = float(ml_model["threshold"])
    prediction = int(probability >= threshold)
    return {
        "default_probability": probability,
        "default_prediction": prediction,
        "threshold": threshold,
        "Result": "High Risk" if prediction == 1 else "Low Risk",
    }


app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")