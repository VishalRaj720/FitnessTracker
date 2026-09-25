import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("fitsathi")


class AppError(Exception):
    """Domain error rendered as {"error": {"code", "message"}} with the given status."""

    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _envelope(code: str, message: str, status: int, details=None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return _envelope(exc.code, exc.message, exc.status)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        # A model_validator's ValueError rides along in each error's ctx as the exception
        # object itself, which JSON can't hold — stringify it rather than turning a 422 into
        # a 500.
        details = jsonable_encoder(exc.errors(), custom_encoder={Exception: str})
        return _envelope("validation_error", "Invalid request", 422, details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found", 429: "rate_limited"}.get(
            exc.status_code, "http_error"
        )
        return _envelope(code, str(exc.detail), exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return _envelope("internal_error", "Something went wrong", 500)
